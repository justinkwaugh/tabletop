import type { HydratedAction, MachineStateHandler } from '@tabletop/common'
import { MachineState } from './states.js'
import type { HydratedSarGameState } from '../model/gameState.js'
import { BiddingStateHandler } from '../stateHandlers/bidding.js'
import { ChoosingActionStateHandler } from '../stateHandlers/choosingAction.js'
import { ConstructingTrackStateHandler } from '../stateHandlers/constructingTrack.js'
import { DelegatedBuildStateHandler } from '../stateHandlers/delegatedBuild.js'
import { DevelopingSettlementsStateHandler } from '../stateHandlers/developingSettlements.js'
import { EndOfGameStateHandler } from '../stateHandlers/endOfGame.js'
import { FreeBuildStateHandler } from '../stateHandlers/freeBuild.js'
import { OfferingStockStateHandler } from '../stateHandlers/offeringStock.js'
import { PayingDividendsStateHandler } from '../stateHandlers/payingDividends.js'

export const SarStateHandlers: Record<
    MachineState,
    MachineStateHandler<HydratedAction, HydratedSarGameState>
> = {
    [MachineState.Bidding]: new BiddingStateHandler(),
    [MachineState.FreeBuild]: new FreeBuildStateHandler(),
    [MachineState.ChoosingAction]: new ChoosingActionStateHandler(),
    [MachineState.ConstructingTrack]: new ConstructingTrackStateHandler(),
    [MachineState.DelegatedBuild]: new DelegatedBuildStateHandler(),
    [MachineState.DevelopingSettlements]: new DevelopingSettlementsStateHandler(),
    [MachineState.OfferingStock]: new OfferingStockStateHandler(),
    [MachineState.PayingDividends]: new PayingDividendsStateHandler(),
    [MachineState.EndOfGame]: new EndOfGameStateHandler()
}
