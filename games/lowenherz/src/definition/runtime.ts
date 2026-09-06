import { assert, DefaultStateLogger, Visibility, type GameRuntime } from '@tabletop/common'
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

import { normalizeLowenherzState } from '../util/normalizePoliticsCards.js'

const stateProjector = Visibility.createProjector(LowenherzGameState)

export const LowenherzRuntime = {
    initializer: new LowenherzGameInitializer(),
    canonicalStateValidator: LowenherzGameStateValidator,
    hydrator: new LowenherzHydrator(),
    stateHandlers: LowenherzStateHandlers,
    apiActions: LowenherzApiActions,
    playerColors: LowenherzColors,
    stateLogger: new DefaultStateLogger(),
    visibility: {
        state: {
            schema: stateProjector.schema,
            project(state: LowenherzGameState, perspective: Visibility.Perspective) {
                const normalized = normalizeLowenherzState(state)
                assert(
                    LowenherzGameStateValidator.Check(normalized),
                    'Cannot project invalid Lowenherz state'
                )
                return stateProjector.project(normalized, perspective)
            },
            guardForExecution<Value extends object>(
                state: Value,
                perspective: Visibility.Perspective
            ): Value {
                return stateProjector.guardForExecution(state, perspective)
            }
        },
        actions: Visibility.createActionProjector(LowenherzActionSchemas)
    }
} satisfies GameRuntime<LowenherzProjectedState, HydratedLowenherzGameState>
