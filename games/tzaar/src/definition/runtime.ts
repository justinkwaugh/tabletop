import { DefaultStateLogger, type GameRuntime } from '@tabletop/common'
import {
    TzaarGameStateValidator,
    type HydratedTzaarGameState,
    type TzaarGameState
} from '../model/gameState.js'
import { TzaarHydrator } from './hydrator.js'
import { TzaarGameInitializer } from './initializer.js'
import { TzaarApiActions } from './apiActions.js'
import { TzaarStateHandlers } from './stateHandlers.js'
import { TzaarColors } from './colors.js'
import { TzaarScoring } from './scoring.js'

export const TzaarRuntime: GameRuntime<TzaarGameState, HydratedTzaarGameState> = {
    initializer: new TzaarGameInitializer(),
    canonicalStateValidator: TzaarGameStateValidator,
    hydrator: new TzaarHydrator(),
    stateHandlers: TzaarStateHandlers,
    apiActions: TzaarApiActions,
    playerColors: TzaarColors,
    stateLogger: new DefaultStateLogger(),
    scoring: new TzaarScoring()
}
