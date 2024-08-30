import { HydratedAction, TerminalStateHandler, type MachineStateHandler } from '@tabletop/common'

import { MachineState } from './states.js'

export const KaivaiStateHandlers: Record<MachineState, MachineStateHandler<HydratedAction>> = {
    [MachineState.Bidding]: new TerminalStateHandler(),
    [MachineState.InitialHuts]: new TerminalStateHandler(),
    [MachineState.EndOfGame]: new TerminalStateHandler()
}
