import { DefaultStateLogger, type GameRuntime } from '@tabletop/common'
import {
    MagnaGreciaGameStateValidator,
    type HydratedMagnaGreciaGameState,
    type MagnaGreciaGameState
} from '../model/gameState.js'
import { MagnaGreciaApiActions } from './apiActions.js'
import { MagnaGreciaColors } from './colors.js'
import { MagnaGreciaHydrator } from './hydrator.js'
import { MagnaGreciaGameInitializer } from './initializer.js'
import { MagnaGreciaScoring } from './scoring.js'
import { MagnaGreciaStateHandlers } from './stateHandlers.js'

export const MagnaGreciaRuntime: GameRuntime<MagnaGreciaGameState, HydratedMagnaGreciaGameState> = {
    initializer: new MagnaGreciaGameInitializer(),
    canonicalStateValidator: MagnaGreciaGameStateValidator,
    hydrator: new MagnaGreciaHydrator(),
    stateHandlers: MagnaGreciaStateHandlers,
    apiActions: MagnaGreciaApiActions,
    playerColors: MagnaGreciaColors,
    scoring: new MagnaGreciaScoring(),
    stateLogger: new DefaultStateLogger()
}
