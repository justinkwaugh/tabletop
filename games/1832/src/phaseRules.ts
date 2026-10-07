import { marketDiscardOrder, type PhaseRules } from '@tabletop/18xx'
import { EighteenThirtyTwoPhases } from './trains.js'

export const EighteenThirtyTwoPhaseRules: PhaseRules = {
    rustTiming: (state, train) =>
        EighteenThirtyTwoPhases.rustTiming(state.phaseId, train.definitionId),
    discardOrder: marketDiscardOrder,
    discardDestination: 'market'
}
