import { LowenherzInfo } from './info.js'
import { LowenherzGameExploration } from './gameExploration.js'
import { assert, defineGame, DefaultStateLogger, Visibility } from '@tabletop/common'
import {
    LowenherzGameStateValidator,
    LowenherzGameState,
    type LowenherzProjectedState,
    type HydratedLowenherzGameState
} from '../model/gameState.js'
import { LowenherzHydrator } from './hydrator.js'
import { LowenherzGameInitializer } from './initializer.js'
import { LowenherzApiActions } from './apiActions.js'
import { LowenherzStateHandlers } from './stateHandlers.js'
import { LowenherzActionSchemas } from './actionSchemas.js'
import { LowenherzColors } from './colors.js'
import { LowenherzScoring } from './scoring.js'

import { normalizeLowenherzState } from '../util/normalizePoliticsCards.js'

const stateProjector = Visibility.createProjector(LowenherzGameState)

export const Definition = defineGame<LowenherzProjectedState, HydratedLowenherzGameState>({
    info: LowenherzInfo,
    runtime: {
        randomnessVersion: 1,
        initializer: new LowenherzGameInitializer(),
        exploration: new LowenherzGameExploration(),
        canonicalStateValidator: LowenherzGameStateValidator,
        hydrator: new LowenherzHydrator(),
        stateHandlers: LowenherzStateHandlers,
        apiActions: LowenherzApiActions,
        playerColors: LowenherzColors,
        stateLogger: new DefaultStateLogger(),
        scoring: new LowenherzScoring(),
        visibility: {
            state: {
                schema: stateProjector.schema,
                project(
                    state: LowenherzGameState,
                    perspective: Visibility.Perspective,
                    context?: Visibility.ProjectionContext
                ) {
                    const normalized = normalizeLowenherzState(state)
                    assert(
                        LowenherzGameStateValidator.Check(normalized),
                        'Cannot project invalid Lowenherz state'
                    )
                    return stateProjector.project(normalized, perspective, context)
                },
                guardForExecution<Value extends object>(
                    state: Value,
                    perspective: Visibility.Perspective,
                    context?: Visibility.ProjectionContext
                ): Value {
                    return stateProjector.guardForExecution(state, perspective, context)
                }
            },
            actions: Visibility.createActionProjector(LowenherzActionSchemas)
        }
    }
})

export const LowenherzRuntime = Definition.runtime
