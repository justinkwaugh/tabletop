import { HydratedAction, TerminalStateHandler, type MachineStateHandler } from '@tabletop/common'

import { MachineState } from './states.js'

export const EstatesStateHandlers: Record<MachineState, MachineStateHandler<HydratedAction>> = {
    [MachineState.StartOfTurn]: new TerminalStateHandler(),
    [MachineState.EndOfGame]: new TerminalStateHandler()
}