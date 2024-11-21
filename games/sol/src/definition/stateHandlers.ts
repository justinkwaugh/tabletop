import { HydratedAction, TerminalStateHandler, type MachineStateHandler } from '@tabletop/common'
import { MachineState } from './states.js'
import { StartOfTurnsStateHandler } from '../stateHandlers/startOfTurn.js'

export const SolStateHandlers: Record<MachineState, MachineStateHandler<HydratedAction>> = {
    [MachineState.StartOfTurn]: new StartOfTurnsStateHandler(),
    [MachineState.Moving]: new TerminalStateHandler(),
    [MachineState.Activating]: new TerminalStateHandler(),
    [MachineState.EndOfGame]: new TerminalStateHandler()
}
