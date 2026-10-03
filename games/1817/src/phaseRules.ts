import type { PhaseRules } from '@tabletop/18xx'
import { EighteenSeventeenPhases, ObsoleteTrainIds } from './trains.js'
export const EighteenSeventeenPhaseRules: PhaseRules = {
    rustTiming(state, train) {
        const timing = EighteenSeventeenPhases.rustTiming(state.phaseId, train.definitionId)
        return timing && ObsoleteTrainIds.includes(train.definitionId) ? 'after-operation' : timing
    },
    // Companies over the limit discard in corporation order, the buyer included.
    discardOrder: (state) =>
        state.companies
            .filter((company) => company.kind !== 'private' && !company.closed)
            .map((company) => company.id),
    discardDestination: 'market'
}
