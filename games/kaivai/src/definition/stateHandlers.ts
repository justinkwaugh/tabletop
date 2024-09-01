import { HydratedAction, TerminalStateHandler, type MachineStateHandler } from '@tabletop/common'

import { MachineState } from './states.js'
import { BiddingStateHandler } from '../stateHandlers/bidding.js'
import { InitialHutsStateHandler } from '../stateHandlers/initialHuts.js'
import { MovingGodStateHandler } from '../stateHandlers/movingGod.js'

export const KaivaiStateHandlers: Record<MachineState, MachineStateHandler<HydratedAction>> = {
    [MachineState.Bidding]: new BiddingStateHandler(),
    [MachineState.InitialHuts]: new InitialHutsStateHandler(),
    [MachineState.MovingGod]: new MovingGodStateHandler(),
    [MachineState.Actions]: new TerminalStateHandler(),
    [MachineState.EndOfGame]: new TerminalStateHandler()
}
