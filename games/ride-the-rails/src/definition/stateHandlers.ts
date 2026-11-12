import {
    TerminalStateHandler,
    type HydratedAction,
    type MachineStateHandler
} from '@tabletop/common'
import type { HydratedRideTheRailsGameState } from '../model/gameState.js'
import { MachineState } from './states.js'

export const RideTheRailsStateHandlers: Record<
    MachineState,
    MachineStateHandler<HydratedAction, HydratedRideTheRailsGameState>
> = {
    [MachineState.TakingShares]: new TerminalStateHandler(),
    [MachineState.Building]: new TerminalStateHandler(),
    [MachineState.Riding]: new TerminalStateHandler(),
    [MachineState.EndingRound]: new TerminalStateHandler(),
    [MachineState.Ended]: new TerminalStateHandler()
}
