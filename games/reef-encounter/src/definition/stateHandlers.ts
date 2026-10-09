import { type HydratedAction, type MachineStateHandler } from '@tabletop/common'
import { MachineState } from './states.js'
import type { HydratedReefEncounterGameState } from '../model/gameState.js'
import { ChoosingParrotfishPolypStateHandler } from '../stateHandlers/choosingParrotfishPolyp.js'
import { ChoosingLarvaCubesStateHandler } from '../stateHandlers/choosingLarvaCubes.js'
import { TakingTurnStateHandler } from '../stateHandlers/takingTurn.js'

export const ReefEncounterStateHandlers: Record<
    MachineState,
    MachineStateHandler<HydratedAction, HydratedReefEncounterGameState>
> = {
    [MachineState.ChoosingParrotfishPolyp]: new ChoosingParrotfishPolypStateHandler(),
    [MachineState.ChoosingLarvaCubes]: new ChoosingLarvaCubesStateHandler(),
    [MachineState.TakingTurn]: new TakingTurnStateHandler()
}
