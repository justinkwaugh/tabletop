import {
    EighteenXXTransferTiming,
    certificateWealthItem,
    dividendEntitlements,
    finiteCashOwnedBy,
    floatedCompaniesInMarketOrder,
    getCompany,
    trainsOwnedBy,
    type EarningsRules,
    type EndingRules,
    type OperatingRules,
    type PhaseRules,
    type PrivatePowerRules,
    type PrivateRules,
    type StationRules,
    type StockMarket,
    type TrainRules,
    type TransferRules
} from '@tabletop/18xx'
import { Charters1862, ShareCount } from './charters.js'
import { Map1862 } from './map.js'
import { Names1862 } from './names.js'
import { IpoPoolId, MarketPoolId } from './pools.js'
import { requireState1862 } from './state.js'
import { Market1862 } from './stockMarket.js'
import { saleValue } from './stockRules.js'
import { freeWarranty } from './warranties.js'
import { endingTrigger } from './lner.js'
import { deciderOf } from './receivers.js'
import { TileSet1862 } from './tiles.js'
import {
    Bands,
    Phases1862,
    TrainDepot1862,
    bandPrice,
    bandRustsOn,
    kindLimit,
    trainFace
} from './trains.js'

export const OperatingRules1862: OperatingRules = {
    charters: Charters1862,
    roundCount: (state) => Phases1862.phase(state.phaseId).operatingRounds,
    // Descending price, then a stack's order (§7.1).
    companyOrder: (state) => floatedCompaniesInMarketOrder(Market1862, state)
}

/** Moves a company's market marker to the bottom of its stack (§7.1). */
export function restackAtBottom(market: StockMarket, companyId: string): void {
    const stack = market.stacks.find((stack) => stack.companyIds.includes(companyId))
    if (!stack) return
    stack.companyIds = [...stack.companyIds.filter((id) => id !== companyId), companyId]
}

export const StationRules1862: StationRules = {
    map: Map1862,
    tileSet: TileSet1862,
    // Stations are bought as the company floats (§7.7).
    placementCost: () => 0,
    // One a turn, none in a turn the company built to London, none once the LNER forms (§7.6.5,
    // §7.7, §10.3).
    placementLimit(state) {
        const title = requireState1862(state)
        return title.lner || title.build === 'london' ? 0 : 1
    },
    // Homes are placed by the title as the company begins its first turn (§7.2).
    pendingHomes: () => []
}

/** What the treasury may add to revenue below the share price to pay it out (§7.8.6). */
export function hudsonTopUp(
    state: Parameters<NonNullable<EarningsRules['treasuryTopUp']>>[0],
    companyId: string,
    revenue: number
): number | undefined {
    const company = getCompany(state, companyId)
    if (!company.president) return undefined
    const price = Market1862.companySpace(state.stockMarket, companyId).price
    if (revenue < 10 || revenue >= price) return undefined
    const topUp = Math.ceil((price - revenue) / 10) * 10
    return finiteCashOwnedBy(state, { kind: 'company', companyId }) >= topUp ? topUp : undefined
}

/**
 * A payment of at least the share price moves the price right once for each multiple of it,
 * up to four; anything less leaves it, and no dividend moves it left (§7.8.5).
 */
export function dividendSteps(dividend: number, price: number): number {
    if (dividend <= 0) return -1
    return Math.min(4, Math.floor(dividend / Math.max(price, 1)))
}

export const EarningsRules1862: EarningsRules = {
    choices: (state, companyId) => [
        'pay',
        'withhold',
        ...(hudsonTopUp(state, companyId, state.routeStep?.result?.revenue ?? 0)
            ? ['top-up' as const]
            : [])
    ],
    shareCount: () => ShareCount,
    // Shares in the IPO and the Bank Pool earn nothing; shares on a company's charter earn for
    // it (§7.8.5).
    entitlements: (state, companyId) =>
        dividendEntitlements(state, companyId, (certificate) =>
            certificate.poolId === IpoPoolId || certificate.poolId === MarketPoolId
                ? undefined
                : certificate.owner
        ),
    retainedRevenue: (_state, _companyId, choice, revenue) => (choice === 'withhold' ? revenue : 0),
    roundDividend: (_state, _companyId, amount) => Math.floor(amount),
    treasuryTopUp: hudsonTopUp,
    marketEffect(state, companyId, distribution) {
        const from = Market1862.companySpace(state.stockMarket, companyId)
        const paid = distribution.revenue - distribution.retained
        const steps = dividendSteps(paid, from.price)
        const to =
            steps < 0
                ? Market1862.move(from.id, 'left', 1)
                : Market1862.move(from.id, 'right', steps)
        return {
            move: { companyId, fromMarketSpaceId: from.id, toMarketSpaceId: to.id },
            bonusPerShare: 0
        }
    },
    // The marker goes to the bottom of its stack, moved or not (§7.1, §7.8.5).
    afterDistribution: (state, companyId) => restackAtBottom(state.stockMarket, companyId)
}

/** The phase whose start retires a band, if any. */
function rustPhase(band: (typeof Bands)[number]): string | undefined {
    return bandRustsOn(band)
}

export const PhaseRules1862: PhaseRules = {
    // A company in receivership has its receiver decide for it (§8).
    activePlayers: (state, companyId) => {
        const playerId = deciderOf(state, companyId)
        return playerId ? [playerId] : []
    },
    // A train rusts with its band unless a warranty holds it (§7.10, §9).
    rustTiming(state, train) {
        const phase = rustPhase(trainFace(train.definitionId).band)
        if (!phase || !Phases1862.isAtLeast(state.phaseId, phase)) return undefined
        return requireState1862(state).warranties[train.id] ? undefined : 'immediate'
    },
    // Excess trains are kept (§7.9).
    discardOrder: () => [],
    discardDestination: 'removed'
}

export const PrivateRules1862: PrivateRules = {
    exchangeTerms: () => undefined,
    phaseEffects: () => [],
    operationEffects: () => [],
    description: () => ''
}

export const PrivatePowerRules1862: PrivatePowerRules = {
    trackTerms: () => undefined,
    earlyTrainCompany: () => undefined
}

/** A train's set price: its face, or half once a later band has been sold (§7.9). */
export function trainPrice(phaseId: string, definitionId: string): number {
    const { band } = trainFace(definitionId)
    const price = bandPrice(band)
    return phaseId > band ? price / 2 : price
}

export const TransferRules1862: TransferRules = {
    ...EighteenXXTransferTiming,
    // A company that raised money for its train buys it from the bank (§7.11).
    canPurchase: (state, companyId, asset) =>
        EighteenXXTransferTiming.canPurchase(state, companyId, asset) &&
        !(asset.kind === 'train' && requireState1862(state).raisedForTrain === companyId),
    charters: Charters1862,
    // Trains change hands between companies at their set price, never after the LNER forms; a
    // company in receivership sells none (§7.9, §8, §10.3).
    priceRange(state, _companyId, asset) {
        if (asset.kind !== 'train' || requireState1862(state).lner) return undefined
        const train = state.trainInventory.trains.find((train) => train.id === asset.trainId)
        if (!train || train.status !== 'owned' || train.owner.kind !== 'company') return undefined
        if (!getCompany(state, train.owner.companyId).president) return undefined
        const price = trainPrice(state.phaseId, train.definitionId)
        return { minimum: price, maximum: price }
    },
    afterPurchase: () => {}
}

/** The kinds a company may run (§6.5.4.3). */
export function permitsOf(state: object, companyId: string) {
    return requireState1862(state).permits[companyId] ?? []
}

export const TrainRules1862: TrainRules = {
    depot: TrainDepot1862,
    // Every company must end its turn with a train (§7.11).
    requiresTrain: () => true,
    exchangePrice: () => undefined,
    availableDefinitions: (state) => {
        const next = TrainDepot1862.definition.supply.find(
            (entry) => TrainDepot1862.remaining(state.trainInventory, entry.definitionId) !== 0
        )
        return next ? TrainDepot1862.certificateDefinitions(next.definitionId) : []
    },
    phaseAfterPurchase: (state, definitionId) =>
        Phases1862.phaseAfterPurchase(state.phaseId, definitionId),
    // Limits are by kind, judged per train; the family's single limit never binds (§7.9).
    trainLimit: () => 99,
    limitReason(state, companyId, definitionId) {
        const limit = kindLimit(state.phaseId)
        const owned = trainsOwnedBy(state, { kind: 'company', companyId })
        if ('total' in limit)
            return owned.length >= limit.total ? 'The company holds three trains.' : undefined
        const { kind } = trainFace(definitionId)
        return owned.filter((train) => trainFace(train.definitionId).kind === kind).length >=
            limit.perKind
            ? `The company holds ${limit.perKind} ${kind} trains.`
            : undefined
    },
    purchaseLimit: () => 'unlimited',
    privatesClosedByPurchase: () => [],
    // A and D trains from the bank come with a warranty (§7.10.1); the first H train sets the
    // LNER to form at the end of the set (§10.3).
    afterTrainsDepart(state, departures) {
        const title = requireState1862(state)
        for (const departure of departures) {
            if (departure.cause !== 'purchase' || departure.owner) continue
            if (freeWarranty(departure.definitionId)) title.warranties[departure.trainId] = 1
            if (trainFace(departure.definitionId).band === 'H') title.lnerDue = true
        }
        return []
    }
}

export const EndingRules1862: EndingRules = {
    trigger: endingTrigger,
    // Shares are worth what they would sell for: half the price for a train-less company.
    certificateItems(state, certificate) {
        const company = getCompany(state, certificate.companyId)
        const value =
            certificate.kind === 'share' && company.started && !company.closed
                ? saleValue(state, company.id) * certificate.shares
                : 0
        return [certificateWealthItem(Names1862, certificate, value)]
    }
}
