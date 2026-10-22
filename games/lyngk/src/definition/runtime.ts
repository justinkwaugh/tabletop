import { DefaultStateLogger, type GameRuntime } from '@tabletop/common'
import {
    LyngkGameStateValidator,
    type HydratedLyngkGameState,
    type LyngkGameState
} from '../model/gameState.js'
import { LyngkHydrator } from './hydrator.js'
import { LyngkGameInitializer } from './initializer.js'
import { LyngkApiActions } from './apiActions.js'
import { LyngkStateHandlers } from './stateHandlers.js'
import { LyngkColors } from './colors.js'
import { LyngkScoring } from './scoring.js'

export const LyngkRuntime: GameRuntime<LyngkGameState, HydratedLyngkGameState> = {
    initializer: new LyngkGameInitializer(),
    canonicalStateValidator: LyngkGameStateValidator,
    hydrator: new LyngkHydrator(),
    stateHandlers: LyngkStateHandlers,
    apiActions: LyngkApiActions,
    playerColors: LyngkColors,
    stateLogger: new DefaultStateLogger(),
    scoring: new LyngkScoring()
}
