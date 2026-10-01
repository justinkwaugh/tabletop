import type { HydratedAction, MachineStateHandler } from '@tabletop/common'
import { MachineState } from './states.js'
import type { HydratedMagnaGreciaGameState } from '../model/gameState.js'
import { EndOfGameStateHandler } from '../stateHandlers/endOfGame.js'
import { TakingTurnStateHandler } from '../stateHandlers/takingTurn.js'

export const MagnaGreciaStateHandlers: Record<
    MachineState,
    MachineStateHandler<HydratedAction, HydratedMagnaGreciaGameState>
> = {
    [MachineState.TakingTurn]: new TakingTurnStateHandler(),
    [MachineState.EndOfGame]: new EndOfGameStateHandler()
}
