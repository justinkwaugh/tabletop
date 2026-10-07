import {
    allSharesHeld,
    floatedCompaniesInMarketOrder,
    getCompany,
    playerOrderAfterLastTurn,
    type OperatingRules,
    type StockRoundRules
} from '@tabletop/18xx'
import { EighteenThirtyTwoPhases } from './trains.js'

export const EighteenThirtyTwoStockRoundRules: StockRoundRules = {
    passing: 'consecutive',
    nextPlayerOrder: playerOrderAfterLastTurn,
    // An operating company rises when players and its own treasury hold every share (§5.2.3).
    soldOut: (state, companyId) =>
        getCompany(state, companyId).floated === true &&
        allSharesHeld(
            state,
            companyId,
            (certificate) =>
                certificate.owner.kind === 'player' || certificate.owner.kind === 'company'
        )
}

export const EighteenThirtyTwoOperatingRules: OperatingRules = {
    roundCount: (state) => EighteenThirtyTwoPhases.phase(state.phaseId).operatingRounds,
    companyOrder: floatedCompaniesInMarketOrder
}
