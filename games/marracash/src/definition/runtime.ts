import { DefaultStateLogger, type GameRuntime, Visibility } from '@tabletop/common'
import {
    MarracashGameState,
    MarracashGameStateValidator,
    type HydratedMarracashGameState,
    type MarracashProjectedState
} from '../model/gameState.js'
import { MarracashHydrator } from './hydrator.js'
import { MarracashGameInitializer } from './initializer.js'
import { MarracashApiActions } from './apiActions.js'
import { MarracashStateHandlers } from './stateHandlers.js'
import { MarracashColors } from './colors.js'
import { MarracashScoring } from './scoring.js'
import { MarracashActionSchemas } from './actionSchemas.js'
import { MarracashGameExploration } from './gameExploration.js'

export const MarracashRuntime = {
    randomnessVersion: 1,
    initializer: new MarracashGameInitializer(),
    exploration: new MarracashGameExploration(),
    canonicalStateValidator: MarracashGameStateValidator,
    hydrator: new MarracashHydrator(),
    stateHandlers: MarracashStateHandlers,
    apiActions: MarracashApiActions,
    playerColors: MarracashColors,
    stateLogger: new DefaultStateLogger(),
    scoring: new MarracashScoring(),
    visibility: {
        state: Visibility.createProjector(MarracashGameState),
        actions: Visibility.createActionProjector(MarracashActionSchemas)
    }
} satisfies GameRuntime<MarracashProjectedState, HydratedMarracashGameState>
