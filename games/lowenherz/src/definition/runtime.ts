import { DefaultStateLogger, type GameRuntime } from '@tabletop/common'
import type { HydratedLowenherzGameState, LowenherzGameState } from '../model/gameState.js'
import { LowenherzHydrator } from './hydrator.js'
import { LowenherzGameInitializer } from './initializer.js'
import { LowenherzApiActions } from './apiActions.js'
import { LowenherzStateHandlers } from './stateHandlers.js'
import { LowenherzColors } from './colors.js'


export const LowenherzRuntime: GameRuntime<LowenherzGameState, HydratedLowenherzGameState> = {
    initializer: new LowenherzGameInitializer(),
    hydrator: new LowenherzHydrator(),
    stateHandlers: LowenherzStateHandlers,
    apiActions: LowenherzApiActions,
    playerColors: LowenherzColors,
    stateLogger: new DefaultStateLogger() // This never really got used, but it could do some custom logging if desired
}
