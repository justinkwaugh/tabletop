import { type HydratedAction, type MachineStateHandler } from '@tabletop/common'
import { MachineState } from './states.js'
import { HydratedSantiagoGameState } from '../model/gameState.js'
import { BiddingStateHandler } from '../stateHandlers/bidding.js'
import { PlantingPhaseStateHandler } from '../stateHandlers/plantingPhase.js'
import { CanalBuildingStateHandler } from '../stateHandlers/canalBuilding.js'
import { ExtraIrrigationStateHandler } from '../stateHandlers/extraIrrigation.js'
import { EndOfGameStateHandler } from '../stateHandlers/endOfGame.js'

export const SantiagoStateHandlers: Record<
    MachineState,
    MachineStateHandler<HydratedAction, HydratedSantiagoGameState>
> = {
    [MachineState.Bidding]: new BiddingStateHandler(),
    [MachineState.PlantingPhase]: new PlantingPhaseStateHandler(),
    [MachineState.CanalBuilding]: new CanalBuildingStateHandler(),
    [MachineState.ExtraIrrigation]: new ExtraIrrigationStateHandler(),
    [MachineState.EndOfGame]: new EndOfGameStateHandler()
}
