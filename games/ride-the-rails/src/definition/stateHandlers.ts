import type { HydratedAction, MachineStateHandler } from '@tabletop/common'
import type { HydratedRideTheRailsGameState } from '../model/gameState.js'
import { BuildingStateHandler } from '../stateHandlers/building.js'
import { EndedStateHandler } from '../stateHandlers/ended.js'
import { EndingRoundStateHandler } from '../stateHandlers/endingRound.js'
import { RidingStateHandler } from '../stateHandlers/riding.js'
import { TakingSharesStateHandler } from '../stateHandlers/takingShares.js'
import { MachineState } from './states.js'

export const RideTheRailsStateHandlers: Record<
    MachineState,
    MachineStateHandler<HydratedAction, HydratedRideTheRailsGameState>
> = {
    [MachineState.TakingShares]: new TakingSharesStateHandler(),
    [MachineState.Building]: new BuildingStateHandler(),
    [MachineState.Riding]: new RidingStateHandler(),
    [MachineState.EndingRound]: new EndingRoundStateHandler(),
    [MachineState.Ended]: new EndedStateHandler()
}
