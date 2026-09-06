import type { GameRuntime } from '@tabletop/common'
import { DefaultStateLogger, Visibility } from '@tabletop/common'
import {
    SolGameStateValidator,
    type HydratedSolGameState,
    SolGameState,
    type SolProjectedState
} from '../model/gameState.js'
import { SolHydrator } from './hydrator.js'
import { SolGameInitializer } from './gameInitializer.js'
import { SolApiActions } from './apiActions.js'
import { SolStateHandlers } from './stateHandlers.js'
import { SolColors } from './colors.js'
import { SolActionSchemas } from './actionSchemas.js'

export const SolRuntime = {
    initializer: new SolGameInitializer(),
    canonicalStateValidator: SolGameStateValidator,
    hydrator: new SolHydrator(),
    stateHandlers: SolStateHandlers,
    apiActions: SolApiActions,
    playerColors: SolColors,
    stateLogger: new DefaultStateLogger(),
    visibility: {
        state: Visibility.createProjector(SolGameState),
        actions: Visibility.createActionProjector(SolActionSchemas)
    }
} satisfies GameRuntime<SolProjectedState, HydratedSolGameState>
