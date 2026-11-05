import { DefaultStateLogger, type GameRuntime } from '@tabletop/common'
import {
    GipfPotentialsGameStateValidator,
    type HydratedGipfPotentialsGameState,
    type GipfPotentialsGameState
} from '../model/gameState.js'
import { GipfPotentialsHydrator } from './hydrator.js'
import { GipfPotentialsGameInitializer } from './initializer.js'
import { GipfPotentialsApiActions } from './apiActions.js'
import { GipfPotentialsStateHandlers } from './stateHandlers.js'
import { GipfPotentialsColors } from './colors.js'
import { GipfPotentialsScoring } from './scoring.js'

export const GipfPotentialsRuntime: GameRuntime<
    GipfPotentialsGameState,
    HydratedGipfPotentialsGameState
> = {
    initializer: new GipfPotentialsGameInitializer(),
    canonicalStateValidator: GipfPotentialsGameStateValidator,
    hydrator: new GipfPotentialsHydrator(),
    stateHandlers: GipfPotentialsStateHandlers,
    apiActions: GipfPotentialsApiActions,
    playerColors: GipfPotentialsColors,
    stateLogger: new DefaultStateLogger(),
    scoring: new GipfPotentialsScoring()
}
