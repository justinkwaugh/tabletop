import { DefaultStateLogger, type GameRuntime } from '@tabletop/common'
import {
    FeudumGameStateValidator,
    type HydratedFeudumGameState,
    type FeudumGameState
} from '../model/gameState.js'
import { FeudumApiActions } from './apiActions.js'
import { FeudumColors } from './colors.js'
import { FeudumHydrator } from './hydrator.js'
import { FeudumGameInitializer } from './initializer.js'
import { FeudumScoring } from './scoring.js'
import { FeudumStateHandlers } from './stateHandlers.js'

export const FeudumRuntime = {
    randomnessVersion: 1,
    initializer: new FeudumGameInitializer(),
    canonicalStateValidator: FeudumGameStateValidator,
    hydrator: new FeudumHydrator(),
    stateHandlers: FeudumStateHandlers,
    apiActions: FeudumApiActions,
    playerColors: FeudumColors,
    scoring: new FeudumScoring(),
    stateLogger: new DefaultStateLogger()
} satisfies GameRuntime<FeudumGameState, HydratedFeudumGameState>
