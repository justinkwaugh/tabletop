import { DefaultStateLogger, type GameRuntime } from '@tabletop/common'
import type { HydratedBusGameState, BusGameState } from '../model/gameState.js'
import { BusHydrator } from './hydrator.js'
import { BusGameInitializer } from './initializer.js'
import { BusApiActions } from './apiActions.js'
import { BusStateHandlers } from './stateHandlers.js'
import { BusColors } from './colors.js'


export const BusRuntime: GameRuntime<BusGameState, HydratedBusGameState> = {
    initializer: new BusGameInitializer(),
    hydrator: new BusHydrator(),
    stateHandlers: BusStateHandlers,
    apiActions: BusApiActions,
    playerColors: BusColors,
    stateLogger: new DefaultStateLogger() // This never really got used, but it could do some custom logging if desired
}
