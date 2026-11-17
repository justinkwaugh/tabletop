import { assertExists } from '@tabletop/common'
import {
    bankBrokenRoundEnding,
    currentPrivateRevenue,
    controllingOwner,
    floatedCompaniesInMarketOrder,
    getCompany,
    loanDiscountedValuation,
    marketDiscardOrder,
    minorAndMajorEarnings,
    minorAndMajorTrains,
    nationalCompanyTransfers,
    poolRedemptionFinance,
    privateOwningCompany,
    type CorporateFinanceRules,
    type EarningsRules,
    type EndingRules,
    type GameEnding,
    type OperatingRules,
    type PhaseRules,
    type PrivateRules,
    type TrainPurchaseState,
    type TrainRules,
    type TransferRules
} from '@tabletop/18xx'
import { Charters1867, CnId, isMinor1867 } from './companies.js'
import { Borrowing1867 } from './loans.js'
import { MarketPoolId1867, Names1867 } from './names.js'
import { PrivateCatalog1867 } from './privates.js'
import { requireState1867 } from './state.js'
import { LeftMove, Market1867, MinorRightMove } from './stockMarket.js'
import {
    MinorNationalisationPhaseId,
    PhaseEightTrainIds1867,
    Phases1867,
    PrivatePurchasePhaseIds,
    TrainDepot1867,
    TrainExportPhaseIds,
    TrainLimits1867
} from './trains.js'

/**
 * Privates pay first, then minors and then majors, each in descending order of price; the CN
 * does not operate (GTG §6.2, §8.13). In phases 4 to 7 the CN exports the cheapest train left
 * in the train yard at the end of every operating round (GTG §8.13).
 */
export const OperatingRules1867: OperatingRules = {
    charters: Charters1867,
    roundCount: (state) => Phases1867.phase(state.phaseId).operatingRounds,
    companyOrder(state) {
        const order = floatedCompaniesInMarketOrder(Market1867, state).filter((id) => id !== CnId)
        return [...order.filter(isMinor1867), ...order.filter((id) => !isMinor1867(id))]
    },
    // The CN has no treasury: privates it holds pay nothing (GTG §8.13).
    privateIncome: (state, privateId) =>
        privateOwningCompany(state, privateId) === CnId
            ? 0
            : currentPrivateRevenue(state, Charters1867, privateId),
    trainsToExport(state) {
        if (!state.operatingSet || !TrainExportPhaseIds.includes(state.phaseId)) return []
        const next = TrainDepot1867.nextDefinitionId(state.trainInventory)
        return next ? [next] : []
    }
}

/**
 * A minor pays half its earnings to its owner and keeps half, moving right but never past $165,
 * or left when it earns nothing. A major pays out, pays half or withholds: it moves right when
 * its dividends total at least its price, left when it pays nothing (GTG §8.9).
 */
export const EarningsRules1867: EarningsRules = minorAndMajorEarnings({
    market: Market1867,
    charters: Charters1867,
    marketPoolId: MarketPoolId1867,
    minorRightMove: MinorRightMove,
    leftMove: LeftMove
})

/**
 * In phase 8 a major may upgrade a train: it gives the train in exchange for half its face value
 * off a dearer train from the train yard (AAG §10.10; the Grand Trunk rulebook omitted this rule
 * and the designer confirmed it). An 8 for an 8, or a 5+5E for an 8, is no upgrade.
 */
function exchangePrice(
    state: TrainPurchaseState,
    companyId: string,
    definitionId: string,
    train: { definitionId: string }
): number | undefined {
    if (!Phases1867.isAtLeast(state.phaseId, MinorNationalisationPhaseId)) return undefined
    if (getCompany(state, companyId).kind !== 'major') return undefined
    const price = TrainDepot1867.trainDefinition(definitionId).price
    const oldPrice = TrainDepot1867.trainDefinition(train.definitionId).price
    if (oldPrice >= price) return undefined
    return price - oldPrice / 2
}

export const TrainRules1867: TrainRules = minorAndMajorTrains({
    depot: TrainDepot1867,
    phases: Phases1867,
    limits: TrainLimits1867,
    lateTrains: { phaseId: MinorNationalisationPhaseId, definitionIds: PhaseEightTrainIds1867 },
    loans: Borrowing1867,
    exchangePrice
})

// Companies over a lowered limit discard to the bank pool without compensation, in operating
// order (GTG §8.11.2).
export const PhaseRules1867: PhaseRules = {
    activePlayers(state, companyId) {
        const director = controllingOwner(state, companyId)
        assertExists(director, 'The deciding company has a director')
        return [director.playerId]
    },
    rustTiming: (state, train) => Phases1867.rustTiming(state.phaseId, train.definitionId),
    discardOrder: (state, companyId) => marketDiscardOrder(Market1867, state, companyId),
    discardDestination: 'market'
}

/** A major may buy back its shares from the bank pool before it runs its trains (GTG §8.5). */
export const CorporateFinanceRules1867: CorporateFinanceRules = poolRedemptionFinance({
    market: Market1867,
    marketPoolId: MarketPoolId1867
})

/** No private has a power or blocks a hex (GTG §3.1). */
export const PrivateRules1867: PrivateRules = {
    exchangeTerms: () => undefined,
    phaseEffects: () => [],
    operationEffects: () => [],
    description: (_state, id) => PrivateCatalog1867.definition(id).description ?? '',
    blocking: () => false
}

/**
 * Companies trade trains at any price of at least $1, never with the CN; in phases 3 to 5 a
 * company buys a player's private for $1 up to its face value (GTG §3.1, §8.11, §8.12).
 */
export const TransferRules1867: TransferRules = nationalCompanyTransfers({
    charters: Charters1867,
    nationalId: CnId,
    privatePurchasePhaseIds: PrivatePurchasePhaseIds,
    privateFaceValue: (privateId) => PrivateCatalog1867.definition(privateId).faceValue
})

/** The first 8-train: the rest of its set, a stock round, then three operating rounds (GTG §12.1). */
function eightTrainEnding(state: object): GameEnding | undefined {
    const title = requireState1867(state)
    const at = title.finalPhaseAt
    if (!at || title.variants.longGame) return undefined
    return { reason: 'First 8-train', finalOperatingSet: at.set + 1, finalOperatingRounds: 3 }
}

/**
 * The game ends after the first 8-train's final rounds or the bank breaking; a share is then
 * worth its price less a space for each loan its company owes, a minor's certificate two shares
 * and a private its face value (GTG §12).
 */
export const EndingRules1867: EndingRules = {
    trigger: (state) => eightTrainEnding(state) ?? bankBrokenRoundEnding(state),
    ...loanDiscountedValuation({
        market: Market1867,
        names: Names1867,
        leftMove: LeftMove,
        privateFaceValue: (privateId) => PrivateCatalog1867.definition(privateId).faceValue
    })
}
