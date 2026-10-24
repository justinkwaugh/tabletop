import type { ParallelSpanDefinition } from '@tabletop/common'
import { CompletePhase } from '../actions/completePhase.js'
import { StartPhase } from '../actions/startPhase.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'
import { SPAN_PHASES, mergeOrder, phaseDefinition } from '../model/turnPlan.js'

export const StellarHorizonsParallelSpans: Record<
    string,
    ParallelSpanDefinition<HydratedStellarHorizonsGameState>
> = Object.fromEntries(
    SPAN_PHASES.map((phase) => {
        const definition = phaseDefinition(phase)
        return [
            definition.branchingState,
            {
                mergeOrder: (state: HydratedStellarHorizonsGameState) => mergeOrder(state, phase),
                merge: definition.merge,
                branchStart: StartPhase,
                spanCompletion: CompletePhase
            }
        ]
    })
)
