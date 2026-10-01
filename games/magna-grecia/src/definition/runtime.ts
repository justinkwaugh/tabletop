import { DefaultStateLogger, Visibility, type GameRuntime } from '@tabletop/common'
import {
    MagnaGreciaGameState,
    MagnaGreciaGameStateValidator,
    type HydratedMagnaGreciaGameState,
    type MagnaGreciaProjectedState
} from '../model/gameState.js'
import { MagnaGreciaApiActions } from './apiActions.js'
import { MagnaGreciaColors } from './colors.js'
import { MagnaGreciaGameExploration } from './exploration.js'
import { MagnaGreciaHydrator } from './hydrator.js'
import { MagnaGreciaGameInitializer } from './initializer.js'
import { MagnaGreciaScoring } from './scoring.js'
import { MagnaGreciaStateHandlers } from './stateHandlers.js'

export const MagnaGreciaRuntime = {
    initializer: new MagnaGreciaGameInitializer(),
    exploration: new MagnaGreciaGameExploration(),
    canonicalStateValidator: MagnaGreciaGameStateValidator,
    hydrator: new MagnaGreciaHydrator(),
    stateHandlers: MagnaGreciaStateHandlers,
    apiActions: MagnaGreciaApiActions,
    playerColors: MagnaGreciaColors,
    scoring: new MagnaGreciaScoring(),
    stateLogger: new DefaultStateLogger(),
    visibility: {
        state: Visibility.createProjector(MagnaGreciaGameState),
        actions: Visibility.createActionProjector(MagnaGreciaApiActions)
    }
} satisfies GameRuntime<MagnaGreciaProjectedState, HydratedMagnaGreciaGameState>
