import { HydratedAction, type MachineStateHandler } from '@tabletop/common'

import { MachineState } from './states.js'
import { StartOfTurnStateHandler } from '../stateHandlers/startOfTurn.js'
import { EndOfGameStateHandler } from '../stateHandlers/endOfGame.js'

export const BridgesStateHandlers: Record<MachineState, MachineStateHandler<HydratedAction>> = {
    [MachineState.StartOfTurn]: new StartOfTurnStateHandler(),
    [MachineState.EndOfGame]: new EndOfGameStateHandler()
}
