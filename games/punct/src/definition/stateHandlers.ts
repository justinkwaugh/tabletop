import { type HydratedAction, type MachineStateHandler } from '@tabletop/common'
import { MachineState } from './states.js'
import type { HydratedPunctGameState } from '../model/gameState.js'
import { TakingTurnStateHandler } from '../stateHandlers/takingTurn.js'
import { EndOfGameStateHandler } from '../stateHandlers/endOfGame.js'

export const PunctStateHandlers: Record<
    MachineState,
    MachineStateHandler<HydratedAction, HydratedPunctGameState>
> = {
    [MachineState.TakingTurn]: new TakingTurnStateHandler(),
    [MachineState.EndOfGame]: new EndOfGameStateHandler()
}
