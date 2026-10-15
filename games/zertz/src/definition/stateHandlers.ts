import { type HydratedAction, type MachineStateHandler } from '@tabletop/common'
import { MachineState } from './states.js'
import type { HydratedZertzGameState } from '../model/gameState.js'
import { TakingTurnStateHandler } from '../stateHandlers/takingTurn.js'
import { RemovingRingStateHandler } from '../stateHandlers/removingRing.js'
import { ContinuingCaptureStateHandler } from '../stateHandlers/continuingCapture.js'
import { EndOfGameStateHandler } from '../stateHandlers/endOfGame.js'

export const ZertzStateHandlers: Record<
    MachineState,
    MachineStateHandler<HydratedAction, HydratedZertzGameState>
> = {
    [MachineState.TakingTurn]: new TakingTurnStateHandler(),
    [MachineState.RemovingRing]: new RemovingRingStateHandler(),
    [MachineState.ContinuingCapture]: new ContinuingCaptureStateHandler(),
    [MachineState.EndOfGame]: new EndOfGameStateHandler()
}
