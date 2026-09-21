import { getCompany, stockMarketOrder, type PhaseRules } from '@tabletop/18xx'
import { Shikoku1889Phases } from './trains.js'
export const Shikoku1889PhaseRules: PhaseRules = {
    rustTiming: (state, train) => Shikoku1889Phases.rustTiming(state.phaseId, train.definitionId),
    discardOrder(state, companyId) {
        return [...new Set([companyId, ...stockMarketOrder(state.stockMarket)])].filter(
            (id) => !getCompany(state, id).closed
        )
    },
    discardDestination: 'market'
}
