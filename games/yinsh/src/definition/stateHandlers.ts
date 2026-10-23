import { type HydratedAction, type MachineStateHandler } from '@tabletop/common'
import { MachineState } from './states.js'
import type { HydratedYinshGameState } from '../model/gameState.js'
import { PlacingRingsStateHandler } from '../stateHandlers/placingRings.js'
import { MovingRingStateHandler } from '../stateHandlers/movingRing.js'
import { RemovingRowStateHandler } from '../stateHandlers/removingRow.js'
import { RemovingRingStateHandler } from '../stateHandlers/removingRing.js'
import { EndOfGameStateHandler } from '../stateHandlers/endOfGame.js'

export const YinshStateHandlers: Record<
    MachineState,
    MachineStateHandler<HydratedAction, HydratedYinshGameState>
> = {
    [MachineState.PlacingRings]: new PlacingRingsStateHandler(),
    [MachineState.MovingRing]: new MovingRingStateHandler(),
    [MachineState.RemovingRow]: new RemovingRowStateHandler(),
    [MachineState.RemovingRing]: new RemovingRingStateHandler(),
    [MachineState.EndOfGame]: new EndOfGameStateHandler()
}
