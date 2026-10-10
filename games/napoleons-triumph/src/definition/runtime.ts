import { DefaultStateLogger, Visibility, type GameRuntime } from '@tabletop/common'
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
import { NapoleonsTriumphStateHandlers } from './stateHandlers.js'

export const NapoleonsTriumphRuntime = {
    randomnessVersion: 1,
    initializer: new NapoleonsTriumphGameInitializer(),
    canonicalStateValidator: NapoleonsTriumphGameStateValidator,
    hydrator: new NapoleonsTriumphHydrator(),
    stateHandlers: NapoleonsTriumphStateHandlers,
    apiActions: NapoleonsTriumphApiActions,
    playerColors: NapoleonsTriumphColors,
    stateLogger: new DefaultStateLogger(),
    visibility: {
        state: Visibility.createProjector(NapoleonsTriumphGameState),
        actions: Visibility.createActionProjector(NapoleonsTriumphApiActions)
    }
} satisfies GameRuntime<NapoleonsTriumphProjectedState, HydratedNapoleonsTriumphGameState>
