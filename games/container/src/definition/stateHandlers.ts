import { type MachineStateHandler, type HydratedAction } from '@tabletop/common'
import { MachineState } from './states.js'
import { TakingActionsStateHandler } from '../stateHandlers/takingActions.js'
import { AuctionBiddingStateHandler } from '../stateHandlers/auctionBidding.js'
import { AuctionResolveStateHandler } from '../stateHandlers/auctionResolve.js'
import { EndOfGameStateHandler } from '../stateHandlers/endOfGame.js'

export const ContainerStateHandlers: Record<MachineState, MachineStateHandler<HydratedAction>> = {
    [MachineState.TakingActions]: new TakingActionsStateHandler(),
    [MachineState.AuctionBidding]: new AuctionBiddingStateHandler(),
    [MachineState.AuctionResolve]: new AuctionResolveStateHandler(),
    [MachineState.EndOfGame]: new EndOfGameStateHandler()
}
