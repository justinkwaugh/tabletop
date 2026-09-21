import { TheOldPrincePhases } from './trains.js'
import {
    allSharesHeld,
    floatedCompaniesInMarketOrder,
    getCompany,
    type StockRoundRules,
    type OperatingRules
} from '@tabletop/18xx'

export const TheOldPrinceStockRoundRules: StockRoundRules = {
    passing: 'pass-order',
    nextPlayerOrder: (state) => [...state.stockRound.passedPlayerIds],
    soldOut: (state, companyId) =>
        allSharesHeld(
            state,
            companyId,
            (certificate) =>
                certificate.owner.kind === 'player' ||
                certificate.poolId === 'reserved' ||
                (certificate.owner.kind === 'company' && certificate.owner.companyId === 'UB')
        )
}
export const TheOldPrinceOperatingRules: OperatingRules = {
    roundCount: (state) => TheOldPrincePhases.phase(state.phaseId).operatingRounds,
    companyOrder(state) {
        const companies = floatedCompaniesInMarketOrder(state)
        if (!getCompany(state, 'PEIR').closed) companies.push('PEIR')
        return companies
    }
}
