import { assertExists } from '@tabletop/common'
import {
    getCompany,
    playerOrderAfterLastTurn,
    stockMarketOrder,
    type StockRoundRules,
    type OperatingRules
} from '@tabletop/18xx'

export const Shikoku1889StockRoundRules: StockRoundRules = {
    passing: 'consecutive',
    nextPlayerOrder: playerOrderAfterLastTurn,
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
                .every((certificate) => !certificate.retired && certificate.owner.kind === 'player')
        )
    }
}
export const Shikoku1889OperatingRoundCounts: Record<string, number> = {
    '2': 1,
    '3': 2,
    '4': 2,
    '5': 3,
    '6': 3,
    D: 3
}
export const Shikoku1889OperatingRules: OperatingRules = {
    roundCount(state) {
        const count = Shikoku1889OperatingRoundCounts[state.phaseId]
        assertExists(count, 'Unknown phase')
        return count
    },
    companyOrder(state) {
        return stockMarketOrder(state.stockMarket).filter((id) => {
            const company = getCompany(state, id)
            return company.floated && !company.closed
        })
    }
}
