import { SantiagoGameExploration } from './gameExploration.js'
import { Visibility, type GameRuntime } from '@tabletop/common'
import {
    SantiagoGameStateValidator,
    SantiagoGameState,
    type SantiagoProjectedState,
    type HydratedSantiagoGameState
} from '../model/gameState.js'
import { SantiagoHydrator } from './hydrator.js'
import { SantiagoGameInitializer } from './gameInitializer.js'
import { SantiagoStateLogger } from '../util/stateLogger.js'
import { SantiagoApiActions } from './apiActions.js'
import { SantiagoStateHandlers } from './stateHandlers.js'
import { SantiagoColors } from './colors.js'

export const SantiagoRuntime = {
    randomnessVersion: 1,
    initializer: new SantiagoGameInitializer(),
    exploration: new SantiagoGameExploration(),
    canonicalStateValidator: SantiagoGameStateValidator,
    hydrator: new SantiagoHydrator(),
    stateHandlers: SantiagoStateHandlers,
    apiActions: SantiagoApiActions,
    playerColors: SantiagoColors,
    stateLogger: new SantiagoStateLogger(),
    visibility: {
        state: Visibility.createProjector(SantiagoGameState),
        actions: Visibility.createActionProjector(SantiagoApiActions)
    }
} satisfies GameRuntime<SantiagoProjectedState, HydratedSantiagoGameState>
