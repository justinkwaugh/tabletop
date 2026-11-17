import { assertExists } from '@tabletop/common'
import {
    bankBrokenRoundEnding,
    controllingOwner,
    floatedCompaniesInMarketOrder,
    getCompany,
    loanDiscountedValuation,
    marketDiscardOrder,
    minorAndMajorEarnings,
    minorAndMajorTrains,
    nationalCompanyTransfers,
    poolRedemptionFinance,
    type CorporateFinanceRules,
    type EarningsRules,
    type EndingRules,
    type GameEnding,
    type OperatingRules,
    type PhaseRules,
    type PrivateRules,
    type TrainRules,
    type TransferRules
} from '@tabletop/18xx'
import { Charters1861, RsrId, isMinor1861 } from './companies.js'
import { Borrowing1861 } from './loans.js'
import { MarketPoolId1861, Names1861 } from './names.js'
import { ReceivershipRules1861, rsrOperates } from './national.js'
import { PrivateCatalog1861 } from './privates.js'
import { requireState1861 } from './state.js'
import { LeftOrDownMove, Market1861, MinorRightMove } from './stockMarket.js'
import {
    DoubleTwoTrainId,
    ExpressTrainId,
    Phases1861,
    PrivatePurchasePhaseIds,
    RsrOperatingPhaseIds,
    TrainDepot1861,
    TrainLimits1861
} from './trains.js'

/**
 * Privates pay first, then minors and then public companies, each in descending order of price,
 * and last the RSR in phases 4 to 7 (§10).
 */
export const OperatingRules1861: OperatingRules = {
    charters: Charters1861,
    roundCount: (state) => Phases1861.phase(state.phaseId).operatingRounds,
    companyOrder(state) {
        const order = floatedCompaniesInMarketOrder(Market1861, state)
        return [
            ...order.filter(isMinor1861),
            ...order.filter((id) => !isMinor1861(id)),
            ...(rsrOperates(state) && getCompany(state, RsrId).started ? [RsrId] : [])
        ]
    },
    // With train exports the RSR takes the next train at the end of each set in phases 4 to 7,
    // just before the second merger round (GTG §14).
    trainsToExport(state) {
        const set = state.operatingSet
        if (!exportsTrains(state) || !set || set.roundNumber !== set.roundCount) return []
        if (!RsrOperatingPhaseIds.includes(state.phaseId)) return []
        const next = TrainDepot1861.nextDefinitionId(state.trainInventory)
        return next ? [next] : []
    }
}

function exportsTrains(state: object): boolean {
    return !!requireState1861(state).variants.trainExports
}

/**
 * A minor pays half its earnings to its owner and keeps half, moving right, up its seventh column,
 * or left when it earns nothing. A public company pays out, pays half or keeps its earnings: it
 * moves right when ten times the dividend per share is at least its price, left when it pays
 * nothing. Treasury shares pay the company and pool shares no one. The RSR keeps everything
 * (§10.7).
 */
export const EarningsRules1861: EarningsRules = minorAndMajorEarnings({
    market: Market1861,
    charters: Charters1861,
    marketPoolId: MarketPoolId1861,
    minorRightMove: MinorRightMove,
    leftMove: LeftOrDownMove
})

export const TrainRules1861: TrainRules = minorAndMajorTrains({
    depot: TrainDepot1861,
    phases: Phases1861,
    limits: TrainLimits1861,
    lateTrains: { phaseId: '8', definitionIds: [ExpressTrainId, DoubleTwoTrainId] },
    loans: Borrowing1861
})

// Companies over a lowered limit discard to the bank pool without compensation, in operating
// order (§10.10).
export const PhaseRules1861: PhaseRules = {
    // The RSR's decisions are its receiver's (§7.4).
    activePlayers(state, companyId) {
        if (companyId === RsrId) return ReceivershipRules1861.operators(state, companyId)
        const director = controllingOwner(state, companyId)
        assertExists(director, 'The deciding company has a director')
        return [director.playerId]
    },
    rustTiming: (state, train) => Phases1861.rustTiming(state.phaseId, train.definitionId),
    discardOrder: (state, companyId) => marketDiscardOrder(Market1861, state, companyId),
    discardDestination: 'market'
}

/**
 * A public company may buy back any of its shares from the bank pool at the current price, from
 * its treasury alone, before it runs its trains (§10.3).
 */
export const CorporateFinanceRules1861: CorporateFinanceRules = poolRedemptionFinance({
    market: Market1861,
    marketPoolId: MarketPoolId1861
})

/** Private company hexes take no track before phase 3 (§8, §10.4). */
export const PrivateRules1861: PrivateRules = {
    exchangeTerms: () => undefined,
    phaseEffects: () => [],
    operationEffects: () => [],
    description: (_state, id) => PrivateCatalog1861.definition(id).description ?? '',
    blocking: (state) => !Phases1861.isAtLeast(state.phaseId, '3')
}

/**
 * Companies trade trains at any price of at least R1, never with the RSR; in phases 3 to 5 a
 * company buys a player's private for R1 up to its face value (§7.1, §10, §10.10).
 */
export const TransferRules1861: TransferRules = nationalCompanyTransfers({
    charters: Charters1861,
    nationalId: RsrId,
    privatePurchasePhaseIds: PrivatePurchasePhaseIds,
    privateFaceValue: (privateId) => PrivateCatalog1861.definition(privateId).faceValue
})

/** The first 8-train: the set's last round with two more after it, or a stock round then three (§13). */
function eightTrainEnding(state: object): GameEnding | undefined {
    const title = requireState1861(state)
    const at = title.finalPhaseAt
    if (!at || title.variants.longGame) return undefined
    return {
        reason: 'First 8-train',
        finalOperatingSet: at.round === 1 ? at.set : at.set + 1,
        finalOperatingRounds: 3
    }
}

/**
 * A share is worth its price less a space a loan its company owes; a minor's certificate counts
 * two shares; a private is worth its face value (§13).
 */
export const EndingRules1861: EndingRules = {
    // The bank broken in a stock round: that round and one operating round more; in an operating
    // round: the rest of it (§13).
    trigger: (state) => eightTrainEnding(state) ?? bankBrokenRoundEnding(state),
    ...loanDiscountedValuation({
        market: Market1861,
        names: Names1861,
        leftMove: LeftOrDownMove,
        privateFaceValue: (privateId) => PrivateCatalog1861.definition(privateId).faceValue
    })
}
