import { DefaultStateLogger, type GameRuntime } from '@tabletop/common'
import {
    DvonnGameStateValidator,
    type HydratedDvonnGameState,
    type DvonnGameState
} from '../model/gameState.js'
import { DvonnHydrator } from './hydrator.js'
import { DvonnGameInitializer } from './initializer.js'
import { DvonnApiActions } from './apiActions.js'
import { DvonnStateHandlers } from './stateHandlers.js'
import { DvonnColors } from './colors.js'
import { DvonnScoring } from './scoring.js'

export const DvonnRuntime: GameRuntime<DvonnGameState, HydratedDvonnGameState> = {
    initializer: new DvonnGameInitializer(),
    canonicalStateValidator: DvonnGameStateValidator,
    hydrator: new DvonnHydrator(),
    stateHandlers: DvonnStateHandlers,
    apiActions: DvonnApiActions,
    playerColors: DvonnColors,
    stateLogger: new DefaultStateLogger(),
    scoring: new DvonnScoring()
}
