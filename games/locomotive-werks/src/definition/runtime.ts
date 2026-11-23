import { DefaultStateLogger, Visibility, type GameRuntime } from '@tabletop/common'
import {
    LwGameState,
    LwGameStateValidator,
    type HydratedLwGameState,
    type LwProjectedState
} from '../model/gameState.js'
import { LwApiActions } from './apiActions.js'
import { LwColors } from './colors.js'
import { LwGameExploration } from './exploration.js'
import { LwHydrator } from './hydrator.js'
import { LwGameInitializer } from './initializer.js'
import { LwProgression } from './progression.js'
import { LwScoring } from './scoring.js'
import { LwStateHandlers } from './stateHandlers.js'

export const LwRuntime = {
    randomnessVersion: 1,
    initializer: new LwGameInitializer(),
    canonicalStateValidator: LwGameStateValidator,
    hydrator: new LwHydrator(),
    stateHandlers: LwStateHandlers,
    apiActions: LwApiActions,
    playerColors: LwColors,
    scoring: new LwScoring(),
    progression: new LwProgression(),
    stateLogger: new DefaultStateLogger(),
    exploration: new LwGameExploration(),
    visibility: {
        state: Visibility.createProjector(LwGameState),
        actions: Visibility.createActionProjector(LwApiActions)
    }
} satisfies GameRuntime<LwProjectedState, HydratedLwGameState>
