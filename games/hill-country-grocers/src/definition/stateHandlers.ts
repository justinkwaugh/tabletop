import type { HydratedAction, MachineStateHandler } from '@tabletop/common'
import { MachineState } from './states.js'
import type { HydratedHcgGameState } from '../model/gameState.js'
import { BiddingStateHandler } from '../stateHandlers/bidding.js'
import { BuildingNetworkStateHandler } from '../stateHandlers/buildingNetwork.js'
import { ChoosingActionStateHandler } from '../stateHandlers/choosingAction.js'
import { DevelopingTownsStateHandler } from '../stateHandlers/developingTowns.js'
import { EndOfGameStateHandler } from '../stateHandlers/endOfGame.js'
import { PayingDividendsStateHandler } from '../stateHandlers/payingDividends.js'
import { PlacingBonusCubeStateHandler } from '../stateHandlers/placingBonusCube.js'
import { StartingAuctionStateHandler } from '../stateHandlers/startingAuction.js'

export const HcgStateHandlers: Record<
    MachineState,
    MachineStateHandler<HydratedAction, HydratedHcgGameState>
> = {
    [MachineState.Bidding]: new BiddingStateHandler(),
    [MachineState.PlacingBonusCube]: new PlacingBonusCubeStateHandler(),
    [MachineState.ChoosingAction]: new ChoosingActionStateHandler(),
    [MachineState.BuildingNetwork]: new BuildingNetworkStateHandler(),
    [MachineState.DevelopingTowns]: new DevelopingTownsStateHandler(),
    [MachineState.StartingAuction]: new StartingAuctionStateHandler(),
    [MachineState.PayingDividends]: new PayingDividendsStateHandler(),
    [MachineState.EndOfGame]: new EndOfGameStateHandler()
}
