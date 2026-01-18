import type { GameRuntime } from '@tabletop/common'
import type { FreshFishGameState, HydratedFreshFishGameState } from '../model/gameState.js'
import { FreshFishHydrator } from './hydrator.js'
import { FreshFishGameInitializer } from './gameInitializer.js'
import { FreshFishStateLogger } from '../util/stateLogger.js'
import { FreshFishApiActions } from './apiActions.js'
import { FreshFishStateHandlers } from './stateHandlers.js'
import { FreshFishColors } from './colors.js'

export const FreshFishRuntime: GameRuntime<FreshFishGameState, HydratedFreshFishGameState> = {
    initializer: new FreshFishGameInitializer(),
    hydrator: new FreshFishHydrator(),
    stateHandlers: FreshFishStateHandlers,
    apiActions: FreshFishApiActions,
    playerColors: FreshFishColors,
    stateLogger: new FreshFishStateLogger()
}
