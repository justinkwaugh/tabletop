import { DefaultStateLogger, type GameRuntime } from '@tabletop/common'
import {
    GipfGameStateValidator,
    type HydratedGipfGameState,
    type GipfGameState
} from '../model/gameState.js'
import { GipfHydrator } from './hydrator.js'
import { GipfGameInitializer } from './initializer.js'
import { GipfApiActions } from './apiActions.js'
import { GipfStateHandlers } from './stateHandlers.js'
import { GipfColors } from './colors.js'
import { GipfScoring } from './scoring.js'

export const GipfRuntime: GameRuntime<GipfGameState, HydratedGipfGameState> = {
    initializer: new GipfGameInitializer(),
    canonicalStateValidator: GipfGameStateValidator,
    hydrator: new GipfHydrator(),
    stateHandlers: GipfStateHandlers,
    apiActions: GipfApiActions,
    playerColors: GipfColors,
    stateLogger: new DefaultStateLogger(),
    scoring: new GipfScoring()
}
