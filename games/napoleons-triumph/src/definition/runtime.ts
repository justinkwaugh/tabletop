import { DefaultStateLogger, Visibility, type GameRuntime } from '@tabletop/common'
import { withArmyDisplays } from '../model/armyDisplay.js'
import {
    NapoleonsTriumphGameState,
    NapoleonsTriumphGameStateValidator,
    type HydratedNapoleonsTriumphGameState,
    type NapoleonsTriumphProjectedState
} from '../model/gameState.js'
import { NapoleonsTriumphApiActions } from './apiActions.js'
import { NapoleonsTriumphColors } from './colors.js'
import { NapoleonsTriumphHydrator } from './hydrator.js'
import { NapoleonsTriumphGameInitializer } from './initializer.js'
import { NapoleonsTriumphScoring } from './scoring.js'
import { NapoleonsTriumphStateHandlers } from './stateHandlers.js'

const stateProjector = Visibility.createProjector(NapoleonsTriumphGameState)

export const NapoleonsTriumphRuntime = {
    randomnessVersion: 1,
    initializer: new NapoleonsTriumphGameInitializer(),
    canonicalStateValidator: NapoleonsTriumphGameStateValidator,
    hydrator: new NapoleonsTriumphHydrator(),
    stateHandlers: NapoleonsTriumphStateHandlers,
    apiActions: NapoleonsTriumphApiActions,
    playerColors: NapoleonsTriumphColors,
    stateLogger: new DefaultStateLogger(),
    scoring: new NapoleonsTriumphScoring(),
    visibility: {
        state: {
            schema: stateProjector.schema,
            project(
                state: NapoleonsTriumphGameState,
                perspective: Visibility.Perspective,
                context?: Visibility.ProjectionContext
            ) {
                return stateProjector.project(withArmyDisplays(state), perspective, context)
            },
            guardForExecution<Value extends object>(
                state: Value,
                perspective: Visibility.Perspective,
                context?: Visibility.ProjectionContext
            ): Value {
                return stateProjector.guardForExecution(state, perspective, context)
            }
        },
        actions: Visibility.createActionProjector(NapoleonsTriumphApiActions)
    }
} satisfies GameRuntime<NapoleonsTriumphProjectedState, HydratedNapoleonsTriumphGameState>
