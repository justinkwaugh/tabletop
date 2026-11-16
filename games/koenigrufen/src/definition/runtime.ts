import { DefaultStateLogger, type GameRuntime, Visibility } from '@tabletop/common'
import {
    KoenigrufenGameState,
    KoenigrufenGameStateValidator,
    type HydratedKoenigrufenGameState,
    type KoenigrufenProjectedState
} from '../model/gameState.js'
import { KoenigrufenActionSchemas } from './actionSchemas.js'
import { KoenigrufenApiActions } from './apiActions.js'
import { KoenigrufenColors } from './colors.js'
import { KoenigrufenHydrator } from './hydrator.js'
import { KoenigrufenGameInitializer } from './initializer.js'
import { KoenigrufenScoring } from './scoring.js'
import { KoenigrufenStateHandlers } from './stateHandlers.js'

export const KoenigrufenRuntime = {
    randomnessVersion: 1,
    initializer: new KoenigrufenGameInitializer(),
    canonicalStateValidator: KoenigrufenGameStateValidator,
    hydrator: new KoenigrufenHydrator(),
    stateHandlers: KoenigrufenStateHandlers,
    apiActions: KoenigrufenApiActions,
    playerColors: KoenigrufenColors,
    stateLogger: new DefaultStateLogger(),
    scoring: new KoenigrufenScoring(),
    visibility: {
        state: Visibility.createProjector(KoenigrufenGameState),
        actions: Visibility.createActionProjector(KoenigrufenActionSchemas)
    }
} satisfies GameRuntime<KoenigrufenProjectedState, HydratedKoenigrufenGameState>
