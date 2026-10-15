import { DefaultStateLogger, type GameRuntime } from '@tabletop/common'
import {
    ZertzGameStateValidator,
    type HydratedZertzGameState,
    type ZertzGameState
} from '../model/gameState.js'
import { ZertzHydrator } from './hydrator.js'
import { ZertzGameInitializer } from './initializer.js'
import { ZertzApiActions } from './apiActions.js'
import { ZertzStateHandlers } from './stateHandlers.js'
import { ZertzColors } from './colors.js'
import { ZertzScoring } from './scoring.js'

export const ZertzRuntime: GameRuntime<ZertzGameState, HydratedZertzGameState> = {
    initializer: new ZertzGameInitializer(),
    canonicalStateValidator: ZertzGameStateValidator,
    hydrator: new ZertzHydrator(),
    stateHandlers: ZertzStateHandlers,
    apiActions: ZertzApiActions,
    playerColors: ZertzColors,
    stateLogger: new DefaultStateLogger(),
    scoring: new ZertzScoring()
}
