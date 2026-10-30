import {
    TrackNetwork,
    controllingOwner,
    finiteCashOwnedBy,
    floatedCompaniesInMarketOrder,
    inReceivership,
    sameOwner,
    sharesOwned,
    stateWith,
    trainsCountingForLimit,
    treasuryPoolId,
    type Owner
} from '@tabletop/18xx'
import { mapState } from './privates.js'
import type { State1833NE } from './state.js'
import { Market1833NE, MarketPoolId } from './stock.js'
import type { ShareSwap, TakeoverOffer } from './takeoverState.js'
import { JointTokenSource } from './track.js'
import { TrainRules1833NE } from './trains.js'

/** No player may own more than 60% of a corporation, by purchase or by swap (§5.35, §11.1). */
const OwnershipLimitShares = 6

/** A holder's outstanding target shares and how many of them it may swap. */
export type Holding = { holder: Owner; shares: number; maximumSwaps: number }

export function sharePrice(state: State1833NE, companyId: string): number {
    return Market1833NE.companySpace(state.stockMarket, companyId).price
}

/** The target's shares held by players and in the Stock Market, which a takeover redeems. */
function outstandingShares(state: State1833NE, targetId: string) {
    const holdings: { holder: Owner; shares: number }[] = []
    for (const certificate of state.certificates) {
        if (certificate.kind !== 'share' || certificate.companyId !== targetId) continue
        const holder: Owner | undefined =
            certificate.owner.kind === 'player'
                ? certificate.owner
                : certificate.poolId === MarketPoolId
                  ? { kind: 'bank' }
                  : undefined
        if (!holder) continue
        const holding = holdings.find((entry) => sameOwner(entry.holder, holder))
        if (holding) holding.shares += certificate.shares
        else holdings.push({ holder, shares: certificate.shares })
    }
    return holdings
}

/** The acquirer's shares still in its treasury, which a takeover may swap (§11). */
export function unissuedShareIds(state: State1833NE, companyId: string): string[] {
    return state.certificates.flatMap((certificate) =>
        certificate.kind === 'share' &&
        !certificate.president &&
        certificate.companyId === companyId &&
        certificate.poolId === treasuryPoolId(companyId)
            ? [certificate.id]
            : []
    )
}

/** How many of the acquirer's shares a holder may take without passing 60% (§11.1). */
function swapCapacity(state: State1833NE, acquirerId: string, holder: Owner): number {
    return holder.kind === 'player'
        ? Math.max(0, OwnershipLimitShares - sharesOwned(state, acquirerId, holder))
        : Infinity
}

/** Each holder of the target's outstanding shares, with the most it may take in swaps. */
export function targetHoldings(
    state: State1833NE,
    acquirerId: string,
    targetId: string
): Holding[] {
    return outstandingShares(state, targetId).map((holding) => ({
        ...holding,
        maximumSwaps: Math.min(holding.shares, swapCapacity(state, acquirerId, holding.holder))
    }))
}

export function swapsFor(swaps: readonly ShareSwap[], holder: Owner): number {
    return swaps.find((swap) => sameOwner(swap.holder, holder))?.shares ?? 0
}

function totalShares(entries: readonly { shares: number }[]): number {
    return entries.reduce((sum, entry) => sum + entry.shares, 0)
}

/** What an offer pays each holder and in all, and how many shares it swaps. */
export function redemptionTerms(state: State1833NE, offer: TakeoverOffer) {
    const price = sharePrice(state, offer.targetId)
    const holdings = targetHoldings(state, offer.companyId, offer.targetId).map((holding) => {
        const swapped = swapsFor(offer.swaps, holding.holder)
        return { ...holding, swapped, cash: (holding.shares - swapped) * price }
    })
    return {
        price,
        holdings,
        swapped: totalShares(offer.swaps),
        cash: holdings.reduce((sum, holding) => sum + holding.cash, 0)
    }
}

/** A corporation with a president and a train not phased out may attempt a takeover (§11). */
function canAttempt(state: State1833NE, companyId: string): boolean {
    return (
        !!controllingOwner(state, companyId) &&
        !inReceivership(state, companyId) &&
        trainsCountingForLimit(state, TrainRules1833NE, companyId).length > 0
    )
}

/** Where a corporation's tokens are, with the joint token's share (§11.2). */
function tokenCenters(state: State1833NE, companyId: string) {
    return [
        ...state.stations.flatMap((station) =>
            station.status === 'placed' && station.companyId === companyId ? [station.position] : []
        ),
        ...(state.stationAccess ?? []).filter(
            (access) => access.companyId === companyId && access.sourceId === JointTokenSource
        )
    ]
}

/**
 * The corporations whose tokens track joins to one of the acquirer's, not through a city other
 * corporations fill; the Ogdensburg and the D&H do not count as tokens (§11, §11.2–11.3).
 */
function connectedCompanies(state: State1833NE, acquirerId: string, companyIds: string[]) {
    const network = new TrackNetwork(
        mapState(state),
        stateWith(state, {
            stationAccess: state.stationAccess?.filter((access) => access.placesStations !== false)
        }),
        acquirerId
    )
    return companyIds.filter((companyId) =>
        tokenCenters(state, companyId).some((center) =>
            network.reaches(center.locationId, { kind: 'node', nodeId: center.nodeId })
        )
    )
}

function treasury(state: State1833NE, companyId: string): number {
    return finiteCashOwnedBy(state, { kind: 'company', companyId })
}

/**
 * The fewest swaps that let the acquirer pay for the rest, taken from players before the Stock
 * Market, or undefined when no mix of swaps and cash is enough (§11).
 */
export function fewestSwaps(
    state: State1833NE,
    acquirerId: string,
    targetId: string
): ShareSwap[] | undefined {
    const price = sharePrice(state, targetId)
    const holdings = targetHoldings(state, acquirerId, targetId)
    const shortfall = totalShares(holdings) * price - treasury(state, acquirerId)
    let needed = shortfall > 0 ? Math.ceil(shortfall / price) : 0
    let unissued = unissuedShareIds(state, acquirerId).length
    const swaps: ShareSwap[] = []
    for (const holding of holdings.toSorted(
        (a, b) => Number(a.holder.kind === 'bank') - Number(b.holder.kind === 'bank')
    )) {
        const shares = Math.min(needed, holding.maximumSwaps, unissued)
        if (shares) swaps.push({ holder: holding.holder, shares })
        needed -= shares
        unissued -= shares
    }
    return needed > 0 ? undefined : swaps
}

/** The corporations this one may attempt to take over now. */
export function takeoverTargets(state: State1833NE, acquirerId: string): string[] {
    if (!canAttempt(state, acquirerId)) return []
    const affordable = floatedCompaniesInMarketOrder(Market1833NE, state).filter(
        (targetId) => targetId !== acquirerId && !!fewestSwaps(state, acquirerId, targetId)
    )
    return affordable.length ? connectedCompanies(state, acquirerId, affordable) : []
}

/** Why an offer cannot be made, if it cannot. */
export function offerReason(state: State1833NE, offer: TakeoverOffer): string | undefined {
    if (!takeoverTargets(state, offer.companyId).includes(offer.targetId))
        return 'This corporation cannot take that one over.'
    const holdings = targetHoldings(state, offer.companyId, offer.targetId)
    for (const swap of offer.swaps) {
        const holding = holdings.find((entry) => sameOwner(entry.holder, swap.holder))
        if (!holding || swap.shares > holding.shares)
            return 'A holder gives up only the shares it holds.'
        if (offer.swaps.filter((other) => sameOwner(other.holder, swap.holder)).length > 1)
            return 'Each holder is listed once.'
        if (swap.shares > holding.maximumSwaps)
            return 'No player may own more than 60% of the acquiring corporation.'
    }
    const terms = redemptionTerms(state, offer)
    if (terms.swapped > unissuedShareIds(state, offer.companyId).length)
        return 'The acquiring corporation has too few unissued shares.'
    if (terms.cash > treasury(state, offer.companyId))
        return 'The acquiring corporation cannot pay for the other shares.'
    return undefined
}

/** A target with no trains, or only phased-out ones, cannot refuse (§11.4). */
export function vulnerable(state: State1833NE, companyId: string): boolean {
    return trainsCountingForLimit(state, TrainRules1833NE, companyId).length === 0
}

/**
 * The player who may refuse an offer: none for a vulnerable target, one in receivership, or one
 * whose president also leads the acquirer.
 */
export function consentingPlayer(state: State1833NE, offer: TakeoverOffer): string | undefined {
    if (vulnerable(state, offer.targetId)) return undefined
    const target = controllingOwner(state, offer.targetId)?.playerId
    return target && target !== controllingOwner(state, offer.companyId)?.playerId
        ? target
        : undefined
}
