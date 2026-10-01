import { DefaultStateLogger, type GameRuntime } from '@tabletop/common'
import type { HydratedMarracashGameState, MarracashGameState } from '../model/gameState.js'
import { MarracashHydrator } from './hydrator.js'
import { MarracashGameInitializer } from './initializer.js'
import { MarracashApiActions } from './apiActions.js'
import { MarracashStateHandlers } from './stateHandlers.js'
import { MarracashColors } from './colors.js'

export const MarracashRuntime: GameRuntime<MarracashGameState, HydratedMarracashGameState> = {
    initializer: new MarracashGameInitializer(),
    hydrator: new MarracashHydrator(),
    stateHandlers: MarracashStateHandlers,
    apiActions: MarracashApiActions,
    playerColors: MarracashColors,
    stateLogger: new DefaultStateLogger()
}
