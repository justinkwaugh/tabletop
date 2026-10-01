import { getCompany, stockMarketOrder, type PhaseRules } from '@tabletop/18xx'
import { EighteenThirtyPhases } from './trains.js'
export const EighteenThirtyPhaseRules: PhaseRules = {
    rustTiming: (state, train) =>
        EighteenThirtyPhases.rustTiming(state.phaseId, train.definitionId),
    discardOrder(state, companyId) {
        return [...new Set([companyId, ...stockMarketOrder(state.stockMarket)])].filter(
            (id) => !getCompany(state, id).closed
        )
    },
    discardDestination: 'market'
}
