import { HydratedAction, TerminalStateHandler, type MachineStateHandler } from '@tabletop/common'

import { MachineState } from './states.js'

export const KaivaiStateHandlers: Record<MachineState, MachineStateHandler<HydratedAction>> = {
    [MachineState.StartOfGame]: new TerminalStateHandler(),
    [MachineState.EndOfGame]: new TerminalStateHandler()
}
