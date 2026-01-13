import { type HydratedAction, type MachineStateHandler } from '@tabletop/common'
import { MachineState } from './states.js'
import { StartOfTurnStateHandler } from '../stateHandlers/startOfTurn.js'
import { EndOfGameStateHandler } from '../stateHandlers/endOfGame.js'
import type { HydratedSampleGameState } from '../model/gameState.js'

// The mapping of machine states to their handlers for the Sample game, used by the game engine
export const SampleStateHandlers: Record<
    MachineState,
    MachineStateHandler<HydratedAction, HydratedSampleGameState>
> = {
    [MachineState.StartOfTurn]: new StartOfTurnStateHandler(),
    [MachineState.EndOfGame]: new EndOfGameStateHandler()
}
