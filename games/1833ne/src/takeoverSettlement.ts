import * as Type from 'typebox'
import { assertExists } from '@tabletop/common'
import {
    AssetTransfer,
    CashPayment,
    CompanyClosure,
    Owner,
    PresidencyChange,
    StationTransfer,
    StockMarketMove,
    applyPresidencyChange,
    closeShareCompany,
    evaluatePresidency,
    moveCompanyStations,
    sameCenter,
    settleCashPayments,
    transferCompanyAssets,
    usesStationAt,
    type PlacedStation
} from '@tabletop/18xx'
import type { HydratedState1833NE, State1833NE } from './state.js'
import { Market1833NE, MarketPoolId, StockRules1833NE } from './stock.js'
import { redemptionTerms, sharePrice, unissuedShareIds } from './takeoverRules.js'
import type { TakeoverOffer } from './takeoverState.js'
import { JointTokenSource } from './track.js'
import { PhaseIVTrain, TrainDepot1833NE } from './trains.js'

const Id = Type.String({ minLength: 1 })

export const RedeemedHolding = Type.Object(
    {
        holder: Owner,
        shares: Type.Integer({ minimum: 1 }),
        swappedCertificateIds: Type.Array(Id)
    },
    { additionalProperties: false }
)
export type RedeemedHolding = Type.Static<typeof RedeemedHolding>

export const TakeoverOutcome = Type.Object(
    {
        acquirerId: Id,
        targetId: Id,
        targetPrice: Type.Integer({ minimum: 0 }),
        redeemed: Type.Array(RedeemedHolding),
        payments: Type.Array(CashPayment),
        presidency: Type.Optional(PresidencyChange),
        marketMove: Type.Optional(StockMarketMove),
        stations: StationTransfer,
        assets: AssetTransfer,
        ferryLocationIds: Type.Array(Id),
        removedTrainId: Type.Optional(Id),
        closure: CompanyClosure
    },
    { additionalProperties: false }
)
export type TakeoverOutcome = Type.Static<typeof TakeoverOutcome>

/** Redeems the target's outstanding shares with the acquirer's shares and cash (§11.5.1). */
function redeemShares(state: HydratedState1833NE, offer: TakeoverOffer) {
    const acquirer = { kind: 'company' as const, companyId: offer.companyId }
    const terms = redemptionTerms(state, offer)
    const unissued = unissuedShareIds(state, offer.companyId)
    const payments: CashPayment[] = []
    const redeemed = terms.holdings.map((holding): RedeemedHolding => {
        const swappedCertificateIds = unissued.splice(0, holding.swapped)
        for (const id of swappedCertificateIds) {
            const certificate = state.certificates.find((entry) => entry.id === id)
            assertExists(certificate, 'An unissued share exists')
            certificate.owner = { ...holding.holder }
            if (holding.holder.kind === 'bank') certificate.poolId = MarketPoolId
            else delete certificate.poolId
        }
        if (holding.cash)
            payments.push({ from: acquirer, to: { ...holding.holder }, amount: holding.cash })
        return { holder: holding.holder, shares: holding.shares, swappedCertificateIds }
    })
    settleCashPayments(state, payments)
    return { targetPrice: terms.price, redeemed, payments }
}

/** The acquirer's price moves one box toward the target's (§11.5.2). */
function adjustPrice(state: State1833NE, acquirerId: string, targetPrice: number) {
    const acquirerPrice = sharePrice(state, acquirerId)
    if (targetPrice === acquirerPrice) return undefined
    return Market1833NE.moveCompanyMarker(
        state.stockMarket,
        acquirerId,
        targetPrice < acquirerPrice ? 'left' : 'right',
        1
    )
}

/** The joint token stays where it is; the target's share in it passes on (§11.6–11.7). */
function passJointToken(state: HydratedState1833NE, targetId: string, acquirerId: string) {
    const jointAccess = (state.stationAccess ?? []).filter(
        (access) => access.sourceId === JointTokenSource
    )
    const joint = state.stations.find(
        (station): station is PlacedStation =>
            station.status === 'placed' &&
            station.companyId === targetId &&
            jointAccess.some((access) => sameCenter(access, station.position))
    )
    if (joint) joint.companyId = acquirerId
}

/**
 * The target's uses of places (the joint token's share, the Ogdensburg's and the D&H's
 * offboards), its reserved spaces and its ferries pass to the acquirer (§11.7); a share in a
 * place the acquirer already holds lapses.
 */
function transferRights(state: HydratedState1833NE, targetId: string, acquirerId: string) {
    passJointToken(state, targetId, acquirerId)
    state.stationAccess = (state.stationAccess ?? []).flatMap((access) => {
        if (access.companyId !== targetId && access.companyId !== acquirerId) return [access]
        const held = state.stations.some(
            (station) =>
                station.status === 'placed' &&
                station.companyId === acquirerId &&
                sameCenter(station.position, access)
        )
        if (held) return []
        if (access.companyId === acquirerId) return [access]
        return usesStationAt(state, acquirerId, access.locationId, access.nodeId)
            ? []
            : [{ ...access, companyId: acquirerId }]
    })
    state.stationReservations = state.stationReservations.map((reservation) =>
        reservation.companyId === targetId ? { ...reservation, companyId: acquirerId } : reservation
    )
    const ferryLocationIds: string[] = []
    for (const ferry of state.ferries)
        if (ferry.companyId === targetId) {
            ferry.companyId = acquirerId
            ferryLocationIds.push(ferry.locationId)
        }
    if (state.ferryBonus?.lastAfterRunOf === targetId) state.ferryBonus.lastAfterRunOf = acquirerId
    return ferryLocationIds
}

/** Every odd takeover removes an unsold phase IV train (§11.5.5). */
function removePhaseIVTrain(state: State1833NE): string | undefined {
    if ((state.takeovers ?? []).length % 2 === 0) return undefined
    if (TrainDepot1833NE.remaining(state.trainInventory, PhaseIVTrain) === 0) return undefined
    return TrainDepot1833NE.export(state.trainInventory, PhaseIVTrain).id
}

/**
 * Carries out a takeover (§11.5): the shares redeemed, the presidency rechecked, the price
 * moved, tokens replaced, assets and rights passed on and the target closed. The certificate
 * limit counts corporations not closed, so it drops a row.
 */
export function settleTakeover(state: HydratedState1833NE, offer: TakeoverOffer): TakeoverOutcome {
    const { companyId: acquirerId, targetId } = offer
    const { targetPrice, redeemed, payments } = redeemShares(state, offer)
    const presidency = evaluatePresidency(
        state,
        acquirerId,
        StockRules1833NE.presidencyCandidates(state, acquirerId)
    ).change
    if (presidency) applyPresidencyChange(state, presidency)
    const marketMove = adjustPrice(state, acquirerId, targetPrice)
    const ferryLocationIds = transferRights(state, targetId, acquirerId)
    const stations = moveCompanyStations(state, targetId, acquirerId, { duplicates: 'discard' })
    const assets = transferCompanyAssets(state, targetId, acquirerId, { loans: false })
    state.takeovers = [...(state.takeovers ?? []), { acquirerId, targetId }]
    const closure = closeShareCompany(state, targetId, 'removed')
    const removedTrainId = removePhaseIVTrain(state)
    return {
        acquirerId,
        targetId,
        targetPrice,
        redeemed,
        payments,
        ...(presidency ? { presidency } : {}),
        ...(marketMove ? { marketMove } : {}),
        stations,
        assets,
        ferryLocationIds,
        ...(removedTrainId ? { removedTrainId } : {}),
        closure
    }
}
