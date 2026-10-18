import type { HydratedAction, MachineStateHandler } from '@tabletop/common'
import { MachineState } from './states.js'
import type { HydratedRailheadsGameState } from '../model/gameState.js'
import { ChoosingActionStateHandler } from '../stateHandlers/choosingAction.js'
import { ChoosingIndustryStateHandler } from '../stateHandlers/choosingIndustry.js'
import { EndingRoundStateHandler } from '../stateHandlers/endingRound.js'
import { EndOfGameStateHandler } from '../stateHandlers/endOfGame.js'
import { FinalScoringStateHandler } from '../stateHandlers/finalScoring.js'
import { IssuingShareStateHandler } from '../stateHandlers/issuingShare.js'
import { LayingTrackStateHandler } from '../stateHandlers/layingTrack.js'
import { ResolvingIndustryAuctionStateHandler } from '../stateHandlers/resolvingIndustryAuction.js'
import { SealedBiddingStateHandler } from '../stateHandlers/sealedBidding.js'
import { ShareBiddingStateHandler } from '../stateHandlers/shareBidding.js'

export const RailheadsStateHandlers: Record<
    MachineState,
    MachineStateHandler<HydratedAction, HydratedRailheadsGameState>
> = {
    [MachineState.ShareBidding]: new ShareBiddingStateHandler(),
    [MachineState.ChoosingAction]: new ChoosingActionStateHandler(),
    [MachineState.IssuingShare]: new IssuingShareStateHandler(),
    [MachineState.ChoosingIndustry]: new ChoosingIndustryStateHandler(),
    [MachineState.SealedBidding]: new SealedBiddingStateHandler(),
    [MachineState.ResolvingIndustryAuction]: new ResolvingIndustryAuctionStateHandler(),
    [MachineState.LayingTrack]: new LayingTrackStateHandler(),
    [MachineState.EndingRound]: new EndingRoundStateHandler(),
    [MachineState.FinalScoring]: new FinalScoringStateHandler(),
    [MachineState.EndOfGame]: new EndOfGameStateHandler()
}
