import {
    type HydratedAction,
    TerminalStateHandler,
    type MachineStateHandler
} from '@tabletop/common'
import { MachineState } from './states.js'
import { StartOfTurnStateHandler } from '../stateHandlers/startOfTurn.js'
import { MovingStateHandler } from '../stateHandlers/moving.js'

export const SolStateHandlers: Record<MachineState, MachineStateHandler<HydratedAction>> = {
    [MachineState.StartOfTurn]: new StartOfTurnStateHandler(),
    [MachineState.Moving]: new MovingStateHandler(),
    [MachineState.Activating]: new TerminalStateHandler(),
    [MachineState.EndOfGame]: new TerminalStateHandler()
}
