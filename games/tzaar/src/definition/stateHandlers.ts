import { type HydratedAction, type MachineStateHandler } from '@tabletop/common'
import { MachineState } from './states.js'
import type { HydratedTzaarGameState } from '../model/gameState.js'
import { PlacingPiecesStateHandler } from '../stateHandlers/placingPieces.js'
import { CapturingStateHandler } from '../stateHandlers/capturing.js'
import { SecondMoveStateHandler } from '../stateHandlers/secondMove.js'
import { EndOfGameStateHandler } from '../stateHandlers/endOfGame.js'

export const TzaarStateHandlers: Record<
    MachineState,
    MachineStateHandler<HydratedAction, HydratedTzaarGameState>
> = {
    [MachineState.PlacingPieces]: new PlacingPiecesStateHandler(),
    [MachineState.Capturing]: new CapturingStateHandler(),
    [MachineState.SecondMove]: new SecondMoveStateHandler(),
    [MachineState.EndOfGame]: new EndOfGameStateHandler()
}
