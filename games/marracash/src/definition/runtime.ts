import { DefaultStateLogger, type GameRuntime } from '@tabletop/common'
import {
    MarracashGameStateValidator,
    type HydratedMarracashGameState,
    type MarracashProjectedState
} from '../model/gameState.js'
import { MarracashHydrator } from './hydrator.js'
import { MarracashGameInitializer } from './initializer.js'
import { MarracashApiActions } from './apiActions.js'
import { MarracashStateHandlers } from './stateHandlers.js'
import { MarracashColors } from './colors.js'
import { MarracashScoring } from './scoring.js'

export const MarracashRuntime = {
    randomnessVersion: 1,
    initializer: new MarracashGameInitializer(),
    canonicalStateValidator: MarracashGameStateValidator,
    hydrator: new MarracashHydrator(),
    stateHandlers: MarracashStateHandlers,
    apiActions: MarracashApiActions,
    playerColors: MarracashColors,
    stateLogger: new DefaultStateLogger(),
    scoring: new MarracashScoring()
} satisfies GameRuntime<MarracashProjectedState, HydratedMarracashGameState>
