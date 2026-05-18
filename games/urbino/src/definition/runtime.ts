import { DefaultStateLogger, type GameRuntime } from '@tabletop/common'
import type { HydratedUrbinoGameState, UrbinoGameState } from '../model/gameState.js'
import { UrbinoHydrator } from './hydrator.js'
import { UrbinoGameInitializer } from './initializer.js'
import { UrbinoApiActions } from './apiActions.js'
import { UrbinoStateHandlers } from './stateHandlers.js'
import { UrbinoColors } from './colors.js'

export const UrbinoRuntime: GameRuntime<UrbinoGameState, HydratedUrbinoGameState> = {
    initializer: new UrbinoGameInitializer(),
    hydrator: new UrbinoHydrator(),
    stateHandlers: UrbinoStateHandlers,
    apiActions: UrbinoApiActions,
    playerColors: UrbinoColors,
    stateLogger: new DefaultStateLogger(),
}
