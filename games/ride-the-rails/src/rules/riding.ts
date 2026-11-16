import { MachineState } from '../definition/states.js'
import type { HydratedRideTheRailsGameState } from '../model/gameState.js'

// R-3.3.1: in turn order, each player takes one journey or, with none possible, passes.
export function isRidingPlayer(state: HydratedRideTheRailsGameState, playerId: string): boolean {
    return state.machineState === MachineState.Riding && state.isActivePlayer(playerId)
}
