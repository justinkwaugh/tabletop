import { assertExists } from '@tabletop/common'
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
export const TheOldPrinceOperatingRoundCounts: Record<string, number> = {
    '2H': 1,
    '3H': 1,
    '4H': 2,
    '5H': 2,
    '6H': 2,
    '2+': 2,
    '3+': 2,
    '4+': 3,
    '7': 3,
    D: 3
}
export const TheOldPrinceOperatingRules: OperatingRules = {
    roundCount(state) {
        const count = TheOldPrinceOperatingRoundCounts[state.phaseId]
        assertExists(count, 'Unknown phase')
        return count
    },
    companyOrder(state) {
        const companies = stockMarketOrder(state.stockMarket).filter((id) => {
            const company = getCompany(state, id)
            return company.floated && !company.closed
        })
        if (!getCompany(state, 'PEIR').closed) companies.push('PEIR')
        return companies
    }
}
