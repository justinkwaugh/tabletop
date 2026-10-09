import { EighteenThirtyMarket } from './stockMarket.js'
import { EighteenThirtyPhases } from './trains.js'
import {
    allSharesHeld,
    floatedCompaniesInMarketOrder,
    playerOrderAfterLastTurn,
    type StockRoundRules,
    type OperatingRules
} from '@tabletop/18xx'

export const EighteenThirtyStockRoundRules: StockRoundRules = {
    passing: 'consecutive',
    nextPlayerOrder: playerOrderAfterLastTurn,
    soldOut: (state, companyId) =>
        allSharesHeld(state, companyId, (certificate) => certificate.owner.kind === 'player')
}
export const EighteenThirtyOperatingRules: OperatingRules = {
    roundCount: (state) => EighteenThirtyPhases.phase(state.phaseId).operatingRounds,
    companyOrder: (state) => floatedCompaniesInMarketOrder(EighteenThirtyMarket, state)
}
