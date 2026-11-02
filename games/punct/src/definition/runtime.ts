import { DefaultStateLogger, type GameRuntime } from '@tabletop/common'
import {
    PunctGameStateValidator,
    type HydratedPunctGameState,
    type PunctGameState
} from '../model/gameState.js'
import { PunctHydrator } from './hydrator.js'
import { PunctGameInitializer } from './initializer.js'
import { PunctApiActions } from './apiActions.js'
import { PunctStateHandlers } from './stateHandlers.js'
import { PunctColors } from './colors.js'
import { PunctScoring } from './scoring.js'

export const PunctRuntime: GameRuntime<PunctGameState, HydratedPunctGameState> = {
    initializer: new PunctGameInitializer(),
    canonicalStateValidator: PunctGameStateValidator,
    hydrator: new PunctHydrator(),
    stateHandlers: PunctStateHandlers,
    apiActions: PunctApiActions,
    playerColors: PunctColors,
    stateLogger: new DefaultStateLogger(),
    scoring: new PunctScoring()
}
