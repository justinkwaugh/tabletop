import { type HydratedAction, type MachineStateHandler } from '@tabletop/common'
import { MachineState } from './states.js'
import type { HydratedBusGameState } from '../model/gameState.js'

import { InitialPlacementStateHandler } from '../stateHandlers/initialPlacement.js'
// The mapping of machine states to their handlers for the Sample game, used by the game engine
export const BusStateHandlers: Record<
    MachineState,
    MachineStateHandler<HydratedAction, HydratedBusGameState>
> = {
    [MachineState.InitialPlacement]: new InitialPlacementStateHandler(),

}
