import { getCompany, stockMarketOrder, type PhaseRules } from '@tabletop/18xx'
import { TheOldPrincePhases } from './trains.js'
export const TheOldPrincePhaseRules: PhaseRules = {
    rustTiming(state, train) {
        const timing = TheOldPrincePhases.rustTiming(state.phaseId, train.definitionId)
        if (timing && train.definitionId === '4+' && train.status === 'owned' && !train.hasRun)
            return 'after-operation'
        return timing
    },
    discardOrder(state, companyId) {
        return [...new Set([companyId, ...stockMarketOrder(state.stockMarket), 'PEIR'])].filter(
            (id) => !getCompany(state, id).closed
        )
    },
    discardDestination: 'removed'
}
