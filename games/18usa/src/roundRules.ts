import {
    floatedCompaniesInMarketOrder,
    playerOrderAfterLastTurn,
    type OperatingRules,
    type OperatingState,
    type StockRoundRules,
    type StockState,
    type TrainState
} from '@tabletop/18xx'
import { EighteenUSACharters } from './charters.js'
import { EighteenUSACompanyMarket } from './marketZones.js'
import { EighteenUSAMarket } from './stockMarket.js'
import { eighteenUSAOptions, type EighteenUSAOptions, type EighteenUSAState } from './state.js'
import { removeUnclaimedSubsidies } from './subsidyRules.js'
import { EighteenUSAPhases, EighteenUSATrainDepot } from './trains.js'

// Each share left in the market pool moves its company down two spaces (§11.8).
const PoolDropPerShare = 2

export const EighteenUSAStockRoundRules: StockRoundRules = {
    passing: 'consecutive',
    nextPlayerOrder: playerOrderAfterLastTurn,
    soldOut: (state, companyId) => EighteenUSACompanyMarket.soldOut(state, companyId),
    poolDrop: (state, companyId) =>
        PoolDropPerShare * EighteenUSACompanyMarket.marketPoolShares(state, companyId),
    // The subsidies no company claimed in the first stock round leave the game (§11.6.1).
    afterRound: (state: StockState & EighteenUSAState) => removeUnclaimedSubsidies(state)
}

type ExportState = OperatingState & TrainState & EighteenUSAOptions

function remaining(state: ExportState, definitionId: string): string[] {
    const count = EighteenUSATrainDepot.remaining(state.trainInventory, definitionId)
    return count === 'unlimited' ? [] : Array<string>(count).fill(definitionId)
}

// With 1817's trains the next depot train goes after each round, every 2 while that is a 2.
function seventeenExports(state: ExportState): string[] {
    const next = EighteenUSATrainDepot.nextDefinitionId(state.trainInventory)
    if (!next) return []
    return next === '2' ? remaining(state, '2') : [next]
}

/**
 * After the first operating round every 2 goes, after the second every 2+, none after the third,
 * every 3 after the fourth, and the next depot train after each later round (§12.10).
 */
function exports(state: ExportState): string[] {
    if (eighteenUSAOptions(state).seventeenTrains) return seventeenExports(state)
    const set = state.operatingSet
    if (!set) return []
    const round = (set.number - 1) * 2 + set.roundNumber
    if (round === 1) return remaining(state, '2')
    if (round === 2) return remaining(state, '2+')
    if (round === 3) return []
    if (round === 4) return remaining(state, '3')
    const next = EighteenUSATrainDepot.nextDefinitionId(state.trainInventory)
    return next ? [next] : []
}

export const EighteenUSAOperatingRules: OperatingRules = {
    charters: EighteenUSACharters,
    roundCount: (state) => EighteenUSAPhases.phase(state.phaseId).operatingRounds,
    companyOrder: (state) =>
        floatedCompaniesInMarketOrder(EighteenUSAMarket, state).filter(
            (companyId) => !EighteenUSACompanyMarket.isLiquidated(state.stockMarket, companyId)
        ),
    trainsToExport: exports,
    // Phase 3 begins as the second operating round ends, if no 3-train has begun it (§8).
    phaseAtRoundEnd(state: ExportState) {
        const set = state.operatingSet
        if (eighteenUSAOptions(state).seventeenTrains || !set) return undefined
        const round = (set.number - 1) * 2 + set.roundNumber
        return round === 2 && state.phaseId === '2'
            ? { phaseId: '3', definitionId: '3' }
            : undefined
    }
}
