import { HydratedAction, TerminalStateHandler, type MachineStateHandler } from '@tabletop/common'

import { MachineState } from './states.js'
import { BiddingStateHandler } from '../stateHandlers/bidding.js'
import { InitialHutsStateHandler } from '../stateHandlers/initialHuts.js'
import { MovingGodStateHandler } from '../stateHandlers/movingGod.js'
import { TakingActionsStateHandler } from '../stateHandlers/takingActions.js'
import { BuildingStateHandler } from '../stateHandlers/building.js'

export const KaivaiStateHandlers: Record<MachineState, MachineStateHandler<HydratedAction>> = {
    [MachineState.Bidding]: new BiddingStateHandler(),
    [MachineState.InitialHuts]: new InitialHutsStateHandler(),
    [MachineState.MovingGod]: new MovingGodStateHandler(),
    [MachineState.TakingActions]: new TakingActionsStateHandler(),
    [MachineState.Building]: new BuildingStateHandler(),
    [MachineState.EndOfGame]: new TerminalStateHandler()
}
