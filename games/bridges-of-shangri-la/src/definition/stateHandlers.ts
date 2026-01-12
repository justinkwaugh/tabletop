import { type HydratedAction, type MachineStateHandler } from '@tabletop/common'

import { MachineState } from './states.js'
import { StartOfTurnStateHandler } from '../stateHandlers/startOfTurn.js'
import { EndOfGameStateHandler } from '../stateHandlers/endOfGame.js'
import { RecruitingStudentsStateHandler } from '../stateHandlers/recruitingStudents.js'
import type { HydratedBridgesGameState } from '../model/gameState.js'

export const BridgesStateHandlers: Record<
    MachineState,
    MachineStateHandler<HydratedAction, HydratedBridgesGameState>
> = {
    [MachineState.StartOfTurn]: new StartOfTurnStateHandler(),
    [MachineState.RecruitingStudents]: new RecruitingStudentsStateHandler(),
    [MachineState.EndOfGame]: new EndOfGameStateHandler()
}
