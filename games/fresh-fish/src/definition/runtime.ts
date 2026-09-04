import { type GameRuntime, Visibility } from '@tabletop/common'
import { FreshFishGameState, type HydratedFreshFishGameState } from '../model/gameState.js'
import { FreshFishHydrator } from './hydrator.js'
import { FreshFishGameInitializer } from './gameInitializer.js'
import { FreshFishStateLogger } from '../util/stateLogger.js'
import { FreshFishActionSchemas } from './actionSchemas.js'
import { FreshFishApiActions } from './apiActions.js'
import { FreshFishStateHandlers } from './stateHandlers.js'
import { FreshFishColors } from './colors.js'
import { ActionType } from './actions.js'

export const FreshFishRuntime = {
    initializer: new FreshFishGameInitializer(),
    hydrator: new FreshFishHydrator(),
    stateHandlers: FreshFishStateHandlers,
    apiActions: FreshFishApiActions,
    playerColors: FreshFishColors,
    stateLogger: new FreshFishStateLogger(),
    visibility: {
        state: Visibility.createProjector(FreshFishGameState),
        actions: Visibility.createActionProjector(FreshFishActionSchemas),
        optimisticActionTypes: [
            ActionType.PlaceDisk,
            ActionType.PlaceMarket,
            ActionType.PlaceStall,
            ActionType.Pass
        ]
    }
} satisfies GameRuntime<FreshFishGameState, HydratedFreshFishGameState>
