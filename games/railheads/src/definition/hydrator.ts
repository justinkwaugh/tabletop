import type { GameAction, GameHydrator, HydratedAction } from '@tabletop/common'
import { HydratedRailheadsGameState, type RailheadsProjectedState } from '../model/gameState.js'
import { HydratedChooseAction, isChooseAction } from '../actions/chooseAction.js'
import { HydratedConsolidate, isConsolidate } from '../actions/consolidate.js'
import { HydratedEndRound, isEndRound } from '../actions/endRound.js'
import { HydratedInvestInIndustry, isInvestInIndustry } from '../actions/investInIndustry.js'
import { HydratedIssueShare, isIssueShare } from '../actions/issueShare.js'
import { HydratedLayTrack, isLayTrack } from '../actions/layTrack.js'
import { HydratedPassBid, isPassBid } from '../actions/passBid.js'
import { HydratedPlaceBid, isPlaceBid } from '../actions/placeBid.js'
import { HydratedPlaceSealedBid, isPlaceSealedBid } from '../actions/placeSealedBid.js'
import {
    HydratedResolveIndustryAuction,
    isResolveIndustryAuction
} from '../actions/resolveIndustryAuction.js'
import { HydratedScoreGame, isScoreGame } from '../actions/scoreGame.js'

export class RailheadsHydrator implements GameHydrator<
    RailheadsProjectedState,
    HydratedRailheadsGameState
> {
    hydrateAction(data: GameAction): HydratedAction {
        switch (true) {
            case isPlaceBid(data):
                return new HydratedPlaceBid(data)
            case isPassBid(data):
                return new HydratedPassBid(data)
            case isChooseAction(data):
                return new HydratedChooseAction(data)
            case isConsolidate(data):
                return new HydratedConsolidate(data)
            case isIssueShare(data):
                return new HydratedIssueShare(data)
            case isInvestInIndustry(data):
                return new HydratedInvestInIndustry(data)
            case isPlaceSealedBid(data):
                return new HydratedPlaceSealedBid(data)
            case isResolveIndustryAuction(data):
                return new HydratedResolveIndustryAuction(data)
            case isLayTrack(data):
                return new HydratedLayTrack(data)
            case isEndRound(data):
                return new HydratedEndRound(data)
            case isScoreGame(data):
                return new HydratedScoreGame(data)
            default:
                throw new Error(`Unknown action type ${data.type}`)
        }
    }

    hydrateState(state: RailheadsProjectedState): HydratedRailheadsGameState {
        return new HydratedRailheadsGameState(state)
    }
}
