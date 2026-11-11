import type { GameAction, GameHydrator, HydratedAction } from '@tabletop/common'
import { HydratedOstbahnGameState, type OstbahnGameState } from '../model/gameState.js'
import { HydratedAwardShare, isAwardShare } from '../actions/awardShare.js'
import { HydratedCapitalize, isCapitalize } from '../actions/capitalize.js'
import {
    HydratedDeterminePlayerOrder,
    isDeterminePlayerOrder
} from '../actions/determinePlayerOrder.js'
import { HydratedBuildTrack, isBuildTrack } from '../actions/buildTrack.js'
import {
    HydratedCompleteExpansion,
    HydratedEndExpansion,
    isCompleteExpansion,
    isEndExpansion
} from '../actions/endExpansion.js'
import { HydratedPassBid, isPassBid } from '../actions/passBid.js'
import { HydratedPassTurn, isPassTurn } from '../actions/passTurn.js'
import { HydratedPayDividends, isPayDividends } from '../actions/payDividends.js'
import { HydratedPlaceBid, isPlaceBid } from '../actions/placeBid.js'

export class OstbahnHydrator implements GameHydrator<OstbahnGameState, HydratedOstbahnGameState> {
    hydrateAction(data: GameAction): HydratedAction {
        switch (true) {
            case isPlaceBid(data):
                return new HydratedPlaceBid(data)
            case isPassBid(data):
                return new HydratedPassBid(data)
            case isCapitalize(data):
                return new HydratedCapitalize(data)
            case isBuildTrack(data):
                return new HydratedBuildTrack(data)
            case isEndExpansion(data):
                return new HydratedEndExpansion(data)
            case isCompleteExpansion(data):
                return new HydratedCompleteExpansion(data)
            case isPassTurn(data):
                return new HydratedPassTurn(data)
            case isDeterminePlayerOrder(data):
                return new HydratedDeterminePlayerOrder(data)
            case isAwardShare(data):
                return new HydratedAwardShare(data)
            case isPayDividends(data):
                return new HydratedPayDividends(data)
            default:
                throw new Error(`Unknown action type ${data.type}`)
        }
    }

    hydrateState(state: OstbahnGameState): HydratedOstbahnGameState {
        return new HydratedOstbahnGameState(state)
    }
}
