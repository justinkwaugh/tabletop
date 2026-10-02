import { getCompany, stockMarketOrder, type PhaseRules } from '@tabletop/18xx'
import { EighteenSeventeenPhases, ObsoleteTrainIds } from './trains.js'
export const EighteenSeventeenPhaseRules: PhaseRules = {
    rustTiming(state, train) {
        const timing = EighteenSeventeenPhases.rustTiming(state.phaseId, train.definitionId)
        return timing && ObsoleteTrainIds.includes(train.definitionId) ? 'after-operation' : timing
    },
    discardOrder(state, companyId) {
        return [...new Set([companyId, ...stockMarketOrder(state.stockMarket)])].filter(
            (id) => !getCompany(state, id).closed
        )
    },
    discardDestination: 'market'
}
