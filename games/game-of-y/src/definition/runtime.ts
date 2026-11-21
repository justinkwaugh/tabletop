import { DefaultStateLogger, type GameRuntime } from '@tabletop/common'
import {
    YGameStateValidator,
    type HydratedYGameState,
    type YGameState
} from '../model/gameState.js'
import { YHydrator } from './hydrator.js'
import { YGameInitializer } from './initializer.js'
import { YApiActions } from './apiActions.js'
import { YStateHandlers } from './stateHandlers.js'
import { YColors } from './colors.js'
import { YScoring } from './scoring.js'

export const YRuntime: GameRuntime<YGameState, HydratedYGameState> = {
    randomnessVersion: 1,
    initializer: new YGameInitializer(),
    canonicalStateValidator: YGameStateValidator,
    hydrator: new YHydrator(),
    stateHandlers: YStateHandlers,
    apiActions: YApiActions,
    playerColors: YColors,
    stateLogger: new DefaultStateLogger(),
    scoring: new YScoring()
}
