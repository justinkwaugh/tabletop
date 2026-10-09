import { EighteenThirtyTwoMarket } from './stockMarket.js'
import { marketDiscardOrder, type PhaseRules } from '@tabletop/18xx'
import { EighteenThirtyTwoPhases } from './trains.js'
import { requireEighteenThirtyTwoState } from './state.js'

export const EighteenThirtyTwoPhaseRules: PhaseRules = {
    // With diesels, 5-trains are permanent; the diesel phase rusts the 4s (§17.2).
    rustTiming: (state, train) =>
        requireEighteenThirtyTwoState(state).variants.diesels && train.definitionId === '5'
            ? undefined
            : EighteenThirtyTwoPhases.rustTiming(state.phaseId, train.definitionId),
    discardOrder: (state, companyId) =>
        marketDiscardOrder(EighteenThirtyTwoMarket, state, companyId),
    discardDestination: 'market'
}
