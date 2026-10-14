import { TheOldPrinceMarket } from './stockMarket.js'
import { marketDiscardOrder, type PhaseRules, type TrainPurchaseState } from '@tabletop/18xx'
import type { TheOldPrinceState } from './state.js'
import { TheOldPrincePhases } from './trains.js'
export const TheOldPrincePhaseRules: PhaseRules = {
    rustTiming(
        state: TrainPurchaseState &
            Pick<TheOldPrinceState, 'fourPlusTrainIdsWithOperatingOpportunity'>,
        train
    ) {
        const timing = TheOldPrincePhases.rustTiming(state.phaseId, train.definitionId)
        if (
            timing &&
            train.definitionId === '4+' &&
            train.status === 'owned' &&
            !state.fourPlusTrainIdsWithOperatingOpportunity?.includes(train.id)
        )
            return 'after-operation'
        return timing
    },
    discardOrder: (state, companyId) =>
        marketDiscardOrder(TheOldPrinceMarket, state, companyId, ['PEIR']),
    discardDestination: 'removed'
}
