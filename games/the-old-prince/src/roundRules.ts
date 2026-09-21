import { TheOldPrincePhases } from './trains.js'
import {
    getCompany,
    stockMarketOrder,
    type StockRoundRules,
    type OperatingRules
} from '@tabletop/18xx'

export const TheOldPrinceStockRoundRules: StockRoundRules = {
    passing: 'pass-order',
    nextPlayerOrder: (state) => [...state.stockRound.passedPlayerIds],
    soldOut(state, companyId) {
        const company = getCompany(state, companyId)
        return (
            !!company.started &&
            !company.closed &&
            state.certificates
                .filter(
                    (certificate) =>
                        certificate.kind === 'share' &&
                        certificate.companyId === companyId &&
                        !certificate.retired
                )
                .every(
                    (certificate) =>
                        !certificate.retired &&
                        (certificate.owner.kind === 'player' ||
                            certificate.poolId === 'reserved' ||
                            (certificate.owner.kind === 'company' &&
                                certificate.owner.companyId === 'UB'))
                )
        )
    }
}
export const TheOldPrinceOperatingRules: OperatingRules = {
    roundCount: (state) => TheOldPrincePhases.phase(state.phaseId).operatingRounds,
    companyOrder(state) {
        const companies = stockMarketOrder(state.stockMarket).filter((id) => {
            const company = getCompany(state, id)
            return company.floated && !company.closed
        })
        if (!getCompany(state, 'PEIR').closed) companies.push('PEIR')
        return companies
    }
}
