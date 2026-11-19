import type { HydratedAction, MachineStateHandler } from '@tabletop/common'
import { MachineState } from './states.js'
import type { HydratedYGameState } from '../model/gameState.js'
import { PlacingStonesStateHandler } from '../stateHandlers/placingStones.js'
import { EndOfGameStateHandler } from '../stateHandlers/endOfGame.js'

export const YStateHandlers: Record<
    MachineState,
    MachineStateHandler<HydratedAction, HydratedYGameState>
> = {
    [MachineState.PlacingStones]: new PlacingStonesStateHandler(),
    [MachineState.EndOfGame]: new EndOfGameStateHandler()
}
