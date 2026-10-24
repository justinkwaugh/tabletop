import { type HydratedAction, type MachineStateHandler } from '@tabletop/common'
import { MachineState } from './states.js'
import type { HydratedDvonnGameState } from '../model/gameState.js'
import { PlacingPiecesStateHandler } from '../stateHandlers/placingPieces.js'
import { MovingStacksStateHandler } from '../stateHandlers/movingStacks.js'
import { EndOfGameStateHandler } from '../stateHandlers/endOfGame.js'

export const DvonnStateHandlers: Record<
    MachineState,
    MachineStateHandler<HydratedAction, HydratedDvonnGameState>
> = {
    [MachineState.PlacingPieces]: new PlacingPiecesStateHandler(),
    [MachineState.MovingStacks]: new MovingStacksStateHandler(),
    [MachineState.EndOfGame]: new EndOfGameStateHandler()
}
