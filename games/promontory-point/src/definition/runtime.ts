import { DefaultStateLogger, type GameRuntime } from '@tabletop/common'
import {
    PromontoryPointGameStateValidator,
    type HydratedPromontoryPointGameState,
    type PromontoryPointGameState
} from '../model/gameState.js'
import { PromontoryPointApiActions } from './apiActions.js'
import { PromontoryPointColors } from './colors.js'
import { PromontoryPointHydrator } from './hydrator.js'
import { PromontoryPointGameInitializer } from './initializer.js'
import { PromontoryPointScoring } from './scoring.js'
import { PromontoryPointStateHandlers } from './stateHandlers.js'

export const PromontoryPointRuntime = {
    randomnessVersion: 1,
    initializer: new PromontoryPointGameInitializer(),
    canonicalStateValidator: PromontoryPointGameStateValidator,
    hydrator: new PromontoryPointHydrator(),
    stateHandlers: PromontoryPointStateHandlers,
    apiActions: PromontoryPointApiActions,
    playerColors: PromontoryPointColors,
    scoring: new PromontoryPointScoring(),
    stateLogger: new DefaultStateLogger()
} satisfies GameRuntime<PromontoryPointGameState, HydratedPromontoryPointGameState>
