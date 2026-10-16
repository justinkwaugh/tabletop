import { type HydratedAction, type MachineStateHandler } from '@tabletop/common'
import { MachineState } from './states.js'
import type { HydratedGipfGameState } from '../model/gameState.js'
import { TakingTurnStateHandler } from '../stateHandlers/takingTurn.js'
import { ResolvingRowsStateHandler } from '../stateHandlers/resolvingRows.js'
import { EndOfGameStateHandler } from '../stateHandlers/endOfGame.js'

export const GipfStateHandlers: Record<
    MachineState,
    MachineStateHandler<HydratedAction, HydratedGipfGameState>
> = {
    [MachineState.TakingTurn]: new TakingTurnStateHandler(),
    [MachineState.ResolvingRows]: new ResolvingRowsStateHandler(),
    [MachineState.EndOfGame]: new EndOfGameStateHandler()
}
