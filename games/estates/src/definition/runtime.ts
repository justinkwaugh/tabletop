import { EstatesGameExploration } from './gameExploration.js'
import type { GameRuntime } from '@tabletop/common'
import { DefaultStateLogger, Visibility } from '@tabletop/common'
import {
    EstatesGameStateValidator,
    EstatesGameState,
    type EstatesProjectedState,
    type HydratedEstatesGameState
} from '../model/gameState.js'
import { EstatesHydrator } from './hydrator.js'
import { EstatesGameInitializer } from './gameInitializer.js'
import { EstatesApiActions } from './apiActions.js'
import { EstatesActionSchemas } from './actionSchemas.js'
import { EstatesStateHandlers } from './stateHandlers.js'

export const EstatesRuntime = {
    randomnessVersion: 1,
    initializer: new EstatesGameInitializer(),
    exploration: new EstatesGameExploration(),
    canonicalStateValidator: EstatesGameStateValidator,
    hydrator: new EstatesHydrator(),
    stateHandlers: EstatesStateHandlers,
    apiActions: EstatesApiActions,
    playerColors: [],
    stateLogger: new DefaultStateLogger(),
    visibility: {
        state: Visibility.createProjector(EstatesGameState),
        actions: Visibility.createActionProjector(EstatesActionSchemas)
    }
} satisfies GameRuntime<EstatesProjectedState, HydratedEstatesGameState>
