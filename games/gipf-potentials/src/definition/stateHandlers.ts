import { type HydratedAction, type MachineStateHandler } from '@tabletop/common'
import { MachineState } from './states.js'
import type { HydratedGipfPotentialsGameState } from '../model/gameState.js'
import { TakingTurnStateHandler } from '../stateHandlers/takingTurn.js'
import { ExtraMoveStateHandler } from '../stateHandlers/extraMove.js'
import { ResolvingRowsStateHandler } from '../stateHandlers/resolvingRows.js'
import { EndOfGameStateHandler } from '../stateHandlers/endOfGame.js'

export const GipfPotentialsStateHandlers: Record<
    MachineState,
    MachineStateHandler<HydratedAction, HydratedGipfPotentialsGameState>
> = {
    [MachineState.TakingTurn]: new TakingTurnStateHandler(),
    [MachineState.ExtraMove]: new ExtraMoveStateHandler(),
    [MachineState.ResolvingRows]: new ResolvingRowsStateHandler(),
    [MachineState.EndOfGame]: new EndOfGameStateHandler()
}
