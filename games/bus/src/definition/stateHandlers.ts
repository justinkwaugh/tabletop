import { type HydratedAction, type MachineStateHandler } from '@tabletop/common'
import { MachineState } from './states.js'
import type { HydratedBusGameState } from '../model/gameState.js'

import { InitialPlacementStateHandler } from '../stateHandlers/initialBuildingPlacement.js'
// The mapping of machine states to their handlers for the Sample game, used by the game engine
export const BusStateHandlers: Record<
    MachineState,
    MachineStateHandler<HydratedAction, HydratedBusGameState>
> = {
    [MachineState.InitialBuildingPlacement]: new InitialPlacementStateHandler()
}
