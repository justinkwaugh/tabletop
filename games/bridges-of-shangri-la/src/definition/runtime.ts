import type { GameRuntime } from '@tabletop/common'
import {
    BridgesGameStateValidator,
    type BridgesGameState,
    type HydratedBridgesGameState
} from '../model/gameState.js'
import { BridgesHydrator } from './hydrator.js'
import { BridgesGameInitializer } from './gameInitializer.js'
import { BridgesApiActions } from './apiActions.js'
import { BridgesStateHandlers } from './stateHandlers.js'
import { BridgesColors } from './colors.js'
import { DefaultStateLogger } from '@tabletop/common'

export const BridgesRuntime: GameRuntime<BridgesGameState, HydratedBridgesGameState> = {
    initializer: new BridgesGameInitializer(),
    canonicalStateValidator: BridgesGameStateValidator,
    hydrator: new BridgesHydrator(),

    stateHandlers: BridgesStateHandlers,
    playerColors: BridgesColors,
    apiActions: BridgesApiActions,

    stateLogger: new DefaultStateLogger()
}
