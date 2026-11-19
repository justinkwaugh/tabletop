import type { HydratedAction, MachineStateHandler } from '@tabletop/common'
import { MachineState } from './states.js'
import type { HydratedHexGameState } from '../model/gameState.js'
import { PlacingStonesStateHandler } from '../stateHandlers/placingStones.js'
import { EndOfGameStateHandler } from '../stateHandlers/endOfGame.js'

export const HexStateHandlers: Record<
    MachineState,
    MachineStateHandler<HydratedAction, HydratedHexGameState>
> = {
    [MachineState.PlacingStones]: new PlacingStonesStateHandler(),
    [MachineState.EndOfGame]: new EndOfGameStateHandler()
}
