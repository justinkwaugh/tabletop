import { DefaultStateLogger, type GameRuntime } from '@tabletop/common'
import {
    YinshGameStateValidator,
    type HydratedYinshGameState,
    type YinshGameState
} from '../model/gameState.js'
import { YinshHydrator } from './hydrator.js'
import { YinshGameInitializer } from './initializer.js'
import { YinshApiActions } from './apiActions.js'
import { YinshStateHandlers } from './stateHandlers.js'
import { YinshColors } from './colors.js'
import { YinshScoring } from './scoring.js'

export const YinshRuntime: GameRuntime<YinshGameState, HydratedYinshGameState> = {
    initializer: new YinshGameInitializer(),
    canonicalStateValidator: YinshGameStateValidator,
    hydrator: new YinshHydrator(),
    stateHandlers: YinshStateHandlers,
    apiActions: YinshApiActions,
    playerColors: YinshColors,
    stateLogger: new DefaultStateLogger(),
    scoring: new YinshScoring()
}
