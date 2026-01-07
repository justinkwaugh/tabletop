import { type HydratedAction, type MachineStateHandler } from '@tabletop/common'
import { MachineState } from './states.js'
import { StartOfTurnStateHandler } from '../stateHandlers/startOfTurn.js'
import { EndOfGameStateHandler } from '../stateHandlers/endOfGame.js'

// The mapping of machine states to their handlers for the Sample game, used by the game engine
export const SampleStateHandlers: Record<MachineState, MachineStateHandler<HydratedAction>> = {
    [MachineState.StartOfTurn]: new StartOfTurnStateHandler(),
    [MachineState.EndOfGame]: new EndOfGameStateHandler()
}
