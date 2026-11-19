import {
    CoalCreekId,
    CoalDepotId,
    DepotSourceId,
    DocHollidayId,
    MarketRoyalGorge,
    MintWorkerId,
    NuggetId,
    RgId,
    SfId,
    TrackEngineerId,
    isBuyMetalShares,
    isChooseSteel,
    isExtendTrain,
    isPayBridgeLease,
    isUseBridgeLease,
    isPayDebt,
    isPlaceGhostTown,
    isSettleOperatingRound,
    isShipGold,
    shipmentBonus,
    type MetalPayout
} from '@tabletop/18royalgorge'
import type { CashPayment } from '@tabletop/18xx'
import {
    counted,
    ownerName,
    type HistoryDescription,
    type HistoryMapPlacement,
    type HistoryNames,
    type MoneyFormat,
    type TitleHistoryNames
} from '@tabletop/18xx-ui'
import type { GameAction } from '@tabletop/common'
import { BridgeLeasePayerWords } from './bridgeLeaseWords.js'

export type HistoryNamesRoyalGorge = HistoryNames & Pick<TitleHistoryNames, 'place'>

export function describeRoyalGorgeMapPlacement(
    action: GameAction
): HistoryMapPlacement | undefined {
    if (isPlaceGhostTown(action))
        return { kind: 'ghost town', companyId: action.companyId, locationIds: [action.locationId] }
    if (isShipGold(action))
        return {
            kind: 'gold shipment',
            companyId: action.companyId,
            locationIds: [action.locationId]
        }
    return undefined
}

const price = (spaceId: string) => MarketRoyalGorge.space(spaceId).price

function payoutLine(payout: MetalPayout, names: HistoryNamesRoyalGorge, money: MoneyFormat) {
    const move = payout.marketMove
    return [
        `${names.companyName(payout.companyId)} paid ${money(payout.revenue)}, ${money(payout.perShare)} a share`,
        ...(move
            ? [`${money(price(move.fromMarketSpaceId))} → ${money(price(move.toMarketSpaceId))}`]
            : [])
    ].join(', ')
}

function paymentLine(payment: CashPayment, names: HistoryNamesRoyalGorge, money: MoneyFormat) {
    return `${ownerName(payment.to, names)} received ${money(payment.amount)}`
}

/** Where each colour's steel comes from: a column of CF&I's market, or the Steel Depot (B3). */
function steelSource(column: string): string {
    return column === DepotSourceId ? 'the Steel Depot' : `column ${column}`
}

/** What lengthened a train, in the cards' words (B5, Y3, G6). */
function extensionSource(sourceId: string, stops: number, names: HistoryNamesRoyalGorge): string {
    if (sourceId === TrackEngineerId) return `the ${names.companyName(TrackEngineerId)}`
    const cubes = counted(stops, 'coal cube')
    return sourceId === CoalCreekId || sourceId === CoalDepotId
        ? `${cubes} from ${names.companyName(sourceId)}`
        : cubes
}

/** The history rows of 18RoyalGorge's own actions, from their input and metadata. */
export function describeRoyalGorgeAction(
    action: GameAction,
    names: HistoryNamesRoyalGorge,
    money: MoneyFormat
): HistoryDescription | undefined {
    const { companyName, place } = names
    if (isSettleOperatingRound(action)) {
        const metadata = action.metadata ?? {}
        const debt = metadata.debtSpaceId
            ? `Debt marker → ${money(price(metadata.debtSpaceId))}`
            : undefined
        const payouts = metadata.payouts ?? []
        if (!payouts.length)
            return debt
                ? { text: debt, omitActor: true, routine: true, consequence: true }
                : { text: 'The operating round ended', omitActor: true, routine: true }
        return {
            text: 'CF&I and VGC paid their shareholders',
            omitActor: true,
            important: true,
            detailLines: [
                ...payouts.map((payout) => payoutLine(payout, names, money)),
                ...(metadata.jewelerPayment
                    ? [paymentLine(metadata.jewelerPayment, names, money)]
                    : []),
                ...(debt ? [debt] : []),
                'The gold track cleared and the steel market refilled'
            ]
        }
    }
    if (isShipGold(action))
        return {
            text: `${companyName(action.companyId)} shipped gold from ${place(action.locationId)}`,
            value: `+${money(shipmentBonus(action))}`,
            detail: action.nugget ? `With the ${companyName(NuggetId)}, which closed` : undefined
        }
    if (isPlaceGhostTown(action))
        return {
            text: `${companyName(action.companyId)} left a ghost town at ${place(action.locationId)}`
        }
    if (isPayDebt(action))
        return {
            text:
                action.companyId === RgId
                    ? `${companyName(RgId)} paid a debt to ${companyName(SfId)}`
                    : `${companyName(action.companyId)} paid one of ${companyName(DocHollidayId)}’s debts`,
            value: money(action.expectedPrice)
        }
    if (isChooseSteel(action))
        return {
            text: `${companyName(action.companyId)} chose ${action.color} steel from ${steelSource(action.column)}`,
            routine: true
        }
    if (isExtendTrain(action))
        return {
            text: `${companyName(action.companyId)} lengthened a train by ${counted(action.stops, 'stop')}`,
            detail: `With ${extensionSource(action.sourceId, action.stops, names)}`
        }
    if (isBuyMetalShares(action)) {
        const mint = action.privateId === MintWorkerId
        return {
            text: `Bought ${counted(action.shares, `${companyName(action.companyId)} share`)} with the ${companyName(action.privateId)}`,
            value: money(action.expectedPrice),
            detail: mint ? `${companyName(MintWorkerId)} closed` : 'Held until the next stock round'
        }
    }
    if (isUseBridgeLease(action))
        return {
            text: `${companyName(action.companyId)} used the Hanging Bridge Lease to run through the gorge`
        }
    if (isPayBridgeLease(action))
        return {
            text: `${companyName(action.companyId)} paid ${companyName(RgId)} for the Hanging Bridge Lease`,
            value: money(action.expectedAmount),
            detail: BridgeLeasePayerWords[action.payer].paidFrom
        }
    return undefined
}
