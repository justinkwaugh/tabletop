import { type HydratedAction, type MachineStateHandler } from '@tabletop/common'
import { MachineState } from './states.js'
import type { HydratedBusGameState } from '../model/gameState.js'

import { AddingPassengersStateHandler } from '../stateHandlers/addingPassengers.js'
import { IncreaseBusesStateHandler } from '../stateHandlers/increaseBuses.js'
import { LineExpansionStateHandler } from '../stateHandlers/lineExpansion.js'
import { ChoosingActionsStateHandler } from '../stateHandlers/choosingActions.js'
import { InitialBusLinePlacementStateHandler } from '../stateHandlers/initialBusLinePlacement.js'
import { InitialPlacementStateHandler } from '../stateHandlers/initialBuildingPlacement.js'
// The mapping of machine states to their handlers for the Sample game, used by the game engine
export const BusStateHandlers: Record<
    MachineState,
    MachineStateHandler<HydratedAction, HydratedBusGameState>
> = {
    [MachineState.InitialBuildingPlacement]: new InitialPlacementStateHandler(),
    [MachineState.InitialBusLinePlacement]: new InitialBusLinePlacementStateHandler(),
    [MachineState.ChoosingActions]: new ChoosingActionsStateHandler(),
    [MachineState.LineExpansion]: new LineExpansionStateHandler(),
    [MachineState.IncreaseBuses]: new IncreaseBusesStateHandler(),
    [MachineState.AddingPassengers]: new AddingPassengersStateHandler()
}
