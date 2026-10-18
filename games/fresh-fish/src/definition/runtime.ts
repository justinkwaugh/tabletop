import { FreshFishInfo } from './info.js'
import { FreshFishGameExploration } from './gameExploration.js'
import { defineGame, type GameRuntime, Visibility } from '@tabletop/common'
import {
    FreshFishGameStateValidator,
    FreshFishGameState,
    type FreshFishProjectedState,
    type HydratedFreshFishGameState
} from '../model/gameState.js'
import { FreshFishHydrator } from './hydrator.js'
import { FreshFishGameInitializer } from './gameInitializer.js'
import { FreshFishActionSchemas } from './actionSchemas.js'
import { FreshFishApiActions } from './apiActions.js'
import { FreshFishStateHandlers } from './stateHandlers.js'
import { FreshFishColors } from './colors.js'
import { FreshFishScoring } from './scoring.js'

export const FreshFishVisibility = {
    state: Visibility.createProjector(FreshFishGameState),
    actions: Visibility.createActionProjector(FreshFishActionSchemas)
}

const runtime = {
    randomnessVersion: 1,
    initializer: new FreshFishGameInitializer(),
    exploration: new FreshFishGameExploration(),
    canonicalStateValidator: FreshFishGameStateValidator,
    hydrator: new FreshFishHydrator(),
    stateHandlers: FreshFishStateHandlers,
    apiActions: FreshFishApiActions,
    playerColors: FreshFishColors,
    scoring: new FreshFishScoring(),
    visibility: FreshFishVisibility
} satisfies Omit<GameRuntime<FreshFishProjectedState, HydratedFreshFishGameState>, 'configuration'>

export const Definition = defineGame<FreshFishProjectedState, HydratedFreshFishGameState>({
    info: FreshFishInfo,
    runtime
})

export const FreshFishRuntime = Definition.runtime
