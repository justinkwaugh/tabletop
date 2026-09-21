import { Shikoku1889Phases } from './trains.js'
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
export const Shikoku1889OperatingRules: OperatingRules = {
    roundCount: (state) => Shikoku1889Phases.phase(state.phaseId).operatingRounds,
    companyOrder(state) {
        return stockMarketOrder(state.stockMarket).filter((id) => {
            const company = getCompany(state, id)
            return company.floated && !company.closed
        })
    }
}
