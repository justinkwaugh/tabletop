import { EighteenNinetyFourMarket } from './stockMarket.js'
import { marketDiscardOrder, type PhaseRules } from '@tabletop/18xx'
import { EighteenNinetyFourPhases } from './trains.js'

// Trains rust as their phase begins; trains over the limit leave the game (§13.5).
export const EighteenNinetyFourPhaseRules: PhaseRules = {
    rustTiming: (state, train) =>
        EighteenNinetyFourPhases.rustTiming(state.phaseId, train.definitionId),
    discardOrder: (state, companyId) =>
        marketDiscardOrder(EighteenNinetyFourMarket, state, companyId),
    discardDestination: 'removed'
}
