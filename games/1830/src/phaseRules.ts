import { marketDiscardOrder, type PhaseRules } from '@tabletop/18xx'
import { EighteenThirtyPhases } from './trains.js'
export const EighteenThirtyPhaseRules: PhaseRules = {
    rustTiming: (state, train) =>
        EighteenThirtyPhases.rustTiming(state.phaseId, train.definitionId),
    discardOrder: (state, companyId) => marketDiscardOrder(state, companyId),
    discardDestination: 'market'
}
