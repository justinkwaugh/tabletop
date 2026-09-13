import { getCompany, stockMarketOrder, type PhaseRules } from '@tabletop/18xx'
import { Shikoku1889Phases } from './trains.js'
export const Shikoku1889TrainRustPhases: Record<string, string> = { '2': '4', '3': '6', '4': 'D' }
export const Shikoku1889PhaseRules: PhaseRules = {
    rustTiming(state, train) {
        const phase = Shikoku1889TrainRustPhases[train.definitionId]
        if (!phase || Shikoku1889Phases.indexOf(state.phaseId) < Shikoku1889Phases.indexOf(phase))
            return undefined
        return 'immediate'
    },
    discardOrder(state, companyId) {
        return [...new Set([companyId, ...stockMarketOrder(state.stockMarket)])].filter(
            (id) => !getCompany(state, id).closed
        )
    },
    discardDestination: 'market'
}
