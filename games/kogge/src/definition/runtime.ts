import { DefaultStateLogger, Visibility, type GameRuntime } from '@tabletop/common'
import {
    KoggeGameState,
    KoggeGameStateValidator,
    type HydratedKoggeGameState,
    type KoggeProjectedState
} from '../model/gameState.js'
import { KoggeActionSchemas, KoggeApiActions } from './apiActions.js'
import { KoggeColors } from './colors.js'
import { KoggeGameExploration } from './exploration.js'
import { KoggeHydrator } from './hydrator.js'
import { KoggeGameInitializer } from './initializer.js'
import { KoggeScoring } from './scoring.js'
import { KoggeStateHandlers } from './stateHandlers.js'

export const KoggeRuntime = {
    randomnessVersion: 1,
    initializer: new KoggeGameInitializer(),
    exploration: new KoggeGameExploration(),
    canonicalStateValidator: KoggeGameStateValidator,
    hydrator: new KoggeHydrator(),
    stateHandlers: KoggeStateHandlers,
    apiActions: KoggeApiActions,
    playerColors: KoggeColors,
    scoring: new KoggeScoring(),
    stateLogger: new DefaultStateLogger(),
    visibility: {
        state: Visibility.createProjector(KoggeGameState),
        actions: Visibility.createActionProjector(KoggeActionSchemas)
    }
} satisfies GameRuntime<KoggeProjectedState, HydratedKoggeGameState>
