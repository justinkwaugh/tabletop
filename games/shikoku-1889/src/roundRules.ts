import { Shikoku1889Phases } from './trains.js'
import {
    allSharesHeld,
    floatedCompaniesInMarketOrder,
    playerOrderAfterLastTurn,
    type StockRoundRules,
    type OperatingRules
} from '@tabletop/18xx'

export const Shikoku1889StockRoundRules: StockRoundRules = {
    passing: 'consecutive',
    nextPlayerOrder: playerOrderAfterLastTurn,
    soldOut: (state, companyId) =>
        allSharesHeld(state, companyId, (certificate) => certificate.owner.kind === 'player')
}
export const Shikoku1889OperatingRules: OperatingRules = {
    roundCount: (state) => Shikoku1889Phases.phase(state.phaseId).operatingRounds,
    companyOrder: floatedCompaniesInMarketOrder
}
