import { getCompany, stockMarketOrder, type PhaseRules } from '@tabletop/18xx'
import { TheOldPrincePhases } from './trains.js'
export const TheOldPrinceTrainRustPhases: Record<string, string> = {
    '2H': '5H',
    '3H': '6H',
    '4H': '2+',
    '5H': '3+',
    '6H': '4+',
    '2+': '7',
    '3+': 'D',
    '4+': 'D'
}
export const TheOldPrincePhaseRules: PhaseRules = {
    rustTiming(state, train) {
        const phase = TheOldPrinceTrainRustPhases[train.definitionId]
        if (!phase || TheOldPrincePhases.indexOf(state.phaseId) < TheOldPrincePhases.indexOf(phase))
            return undefined
        if (train.definitionId === '4+' && train.status === 'owned' && !train.hasRun)
            return 'after-operation'
        return 'immediate'
    },
    discardOrder(state, companyId) {
        return [...new Set([companyId, ...stockMarketOrder(state.stockMarket), 'PEIR'])].filter(
            (id) => !getCompany(state, id).closed
        )
    },
    discardDestination: 'removed'
}
