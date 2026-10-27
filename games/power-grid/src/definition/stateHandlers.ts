import type { HydratedAction, MachineStateHandler } from '@tabletop/common'
import { MachineState } from './states.js'
import type { HydratedPowerGridGameState } from '../model/gameState.js'
import {
    BiddingStateHandler,
    ChoosingPlantStateHandler,
    ClosingAuctionsStateHandler,
    ReplacingPlantStateHandler,
    ScrappingPlantStateHandler,
    TrustTakingPlantStateHandler
} from '../stateHandlers/auction.js'
import {
    BuyingResourcesStateHandler,
    TrustBuyingStateHandler
} from '../stateHandlers/buyingResources.js'
import { PlacingTrustStateHandler } from '../stateHandlers/placingTrust.js'
import { BuildingStateHandler } from '../stateHandlers/building.js'
import {
    PoweringStateHandler,
    RestockingStateHandler,
    StartingStep2StateHandler
} from '../stateHandlers/bureaucracy.js'
import { EndOfGameStateHandler } from '../stateHandlers/endOfGame.js'

export const PowerGridStateHandlers: Record<
    MachineState,
    MachineStateHandler<HydratedAction, HydratedPowerGridGameState>
> = {
    [MachineState.PlacingTrust]: new PlacingTrustStateHandler(),
    [MachineState.ChoosingPlant]: new ChoosingPlantStateHandler(),
    [MachineState.Bidding]: new BiddingStateHandler(),
    [MachineState.ReplacingPlant]: new ReplacingPlantStateHandler(),
    [MachineState.ScrappingPlant]: new ScrappingPlantStateHandler(),
    [MachineState.ClosingAuctions]: new ClosingAuctionsStateHandler(),
    [MachineState.TrustTakingPlant]: new TrustTakingPlantStateHandler(),
    [MachineState.TrustBuying]: new TrustBuyingStateHandler(),
    [MachineState.BuyingResources]: new BuyingResourcesStateHandler(),
    [MachineState.Building]: new BuildingStateHandler(),
    [MachineState.StartingStep2]: new StartingStep2StateHandler(),
    [MachineState.Powering]: new PoweringStateHandler(),
    [MachineState.Restocking]: new RestockingStateHandler(),
    [MachineState.EndOfGame]: new EndOfGameStateHandler()
}
