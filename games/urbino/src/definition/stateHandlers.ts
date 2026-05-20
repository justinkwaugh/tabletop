import { type HydratedAction, type MachineStateHandler } from '@tabletop/common'
import { MachineState } from './states.js'
import type { HydratedUrbinoGameState } from '../model/gameState.js'
import { PlacingArchitectsStateHandler } from '../stateHandlers/placingArchitects.js'
import { ChoosingFirstPlayerStateHandler } from '../stateHandlers/choosingFirstPlayer.js'
import { TakingTurnStateHandler } from '../stateHandlers/takingTurn.js'
import { EndOfGameStateHandler } from '../stateHandlers/endOfGame.js'

export const UrbinoStateHandlers: Record<
    MachineState,
    MachineStateHandler<HydratedAction, HydratedUrbinoGameState>
> = {
    [MachineState.PlacingArchitects]: new PlacingArchitectsStateHandler(),
    [MachineState.ChoosingFirstPlayer]: new ChoosingFirstPlayerStateHandler(),
    [MachineState.TakingTurn]: new TakingTurnStateHandler(),
    [MachineState.EndOfGame]: new EndOfGameStateHandler(),
}
