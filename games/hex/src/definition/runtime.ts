import { DefaultStateLogger, type GameRuntime } from '@tabletop/common'
import {
    HexGameStateValidator,
    type HydratedHexGameState,
    type HexGameState
} from '../model/gameState.js'
import { HexHydrator } from './hydrator.js'
import { HexGameInitializer } from './initializer.js'
import { HexApiActions } from './apiActions.js'
import { HexStateHandlers } from './stateHandlers.js'
import { HexColors } from './colors.js'
import { HexScoring } from './scoring.js'

export const HexRuntime: GameRuntime<HexGameState, HydratedHexGameState> = {
    randomnessVersion: 1,
    initializer: new HexGameInitializer(),
    canonicalStateValidator: HexGameStateValidator,
    hydrator: new HexHydrator(),
    stateHandlers: HexStateHandlers,
    apiActions: HexApiActions,
    playerColors: HexColors,
    stateLogger: new DefaultStateLogger(),
    scoring: new HexScoring()
}
