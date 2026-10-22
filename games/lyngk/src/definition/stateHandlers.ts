import { type HydratedAction, type MachineStateHandler } from '@tabletop/common'
import { MachineState } from './states.js'
import type { HydratedLyngkGameState } from '../model/gameState.js'
import { TakingTurnStateHandler } from '../stateHandlers/takingTurn.js'
import { EndOfGameStateHandler } from '../stateHandlers/endOfGame.js'

export const LyngkStateHandlers: Record<
    MachineState,
    MachineStateHandler<HydratedAction, HydratedLyngkGameState>
> = {
    [MachineState.TakingTurn]: new TakingTurnStateHandler(),
    [MachineState.EndOfGame]: new EndOfGameStateHandler()
}
