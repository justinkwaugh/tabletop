import { DefaultStateLogger, Visibility, type GameRuntime } from '@tabletop/common'
import {
    StellarHorizonsGameState,
    StellarHorizonsGameStateValidator,
    type HydratedStellarHorizonsGameState,
    type StellarHorizonsProjectedState
} from '../model/gameState.js'
import { StellarHorizonsApiActions } from './apiActions.js'
import { StellarHorizonsColors } from './colors.js'
import { StellarHorizonsGameExploration } from './exploration.js'
import { StellarHorizonsHydrator } from './hydrator.js'
import { StellarHorizonsGameInitializer } from './initializer.js'
import { StellarHorizonsStateHandlers } from './stateHandlers.js'

export const StellarHorizonsRuntime = {
    randomnessVersion: 1,
    initializer: new StellarHorizonsGameInitializer(),
    exploration: new StellarHorizonsGameExploration(),
    canonicalStateValidator: StellarHorizonsGameStateValidator,
    hydrator: new StellarHorizonsHydrator(),
    stateHandlers: StellarHorizonsStateHandlers,
    apiActions: StellarHorizonsApiActions,
    playerColors: StellarHorizonsColors,
    stateLogger: new DefaultStateLogger(),
    visibility: {
        state: Visibility.createProjector(StellarHorizonsGameState),
        actions: Visibility.createActionProjector(StellarHorizonsApiActions)
    }
} satisfies GameRuntime<StellarHorizonsProjectedState, HydratedStellarHorizonsGameState>
