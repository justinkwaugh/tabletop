import type { GameRuntime } from '@tabletop/common'
import type { SantiagoGameState, HydratedSantiagoGameState } from '../model/gameState.js'
import { SantiagoHydrator } from './hydrator.js'
import { SantiagoGameInitializer } from './gameInitializer.js'
import { SantiagoStateLogger } from '../util/stateLogger.js'
import { SantiagoApiActions } from './apiActions.js'
import { SantiagoStateHandlers } from './stateHandlers.js'
import { SantiagoColors } from './colors.js'

export const SantiagoRuntime: GameRuntime<SantiagoGameState, HydratedSantiagoGameState> = {
    initializer: new SantiagoGameInitializer(),
    hydrator: new SantiagoHydrator(),
    stateHandlers: SantiagoStateHandlers,
    apiActions: SantiagoApiActions,
    playerColors: SantiagoColors,
    stateLogger: new SantiagoStateLogger()
}
