import type { GameAction, GameHydrator, HydratedAction } from '@tabletop/common'
import { HydratedSarGameState, type SarGameState } from '../model/gameState.js'
import { HydratedBuildConnection, isBuildConnection } from '../actions/buildConnection.js'
import { HydratedBuildTrack, isBuildTrack } from '../actions/buildTrack.js'
import { HydratedChooseAction, isChooseAction } from '../actions/chooseAction.js'
import { HydratedDeclineOffer, isDeclineOffer } from '../actions/declineOffer.js'
import { HydratedDelegateBuild, isDelegateBuild } from '../actions/delegateBuild.js'
import { HydratedDevelop, isDevelop } from '../actions/develop.js'
import { HydratedFinishDevelopment, isFinishDevelopment } from '../actions/finishDevelopment.js'
import {
    HydratedFoundSpecialConnection,
    isFoundSpecialConnection
} from '../actions/foundSpecialConnection.js'
import { HydratedLeaveTown, isLeaveTown } from '../actions/leaveTown.js'
import { HydratedOfferShare, isOfferShare } from '../actions/offerShare.js'
import { HydratedPassBid, isPassBid } from '../actions/passBid.js'
import { HydratedPayDividends, isPayDividends } from '../actions/payDividends.js'
import { HydratedPlaceBid, isPlaceBid } from '../actions/placeBid.js'

export class SarHydrator implements GameHydrator<SarGameState, HydratedSarGameState> {
    hydrateAction(data: GameAction): HydratedAction {
        switch (true) {
            case isPlaceBid(data):
                return new HydratedPlaceBid(data)
            case isPassBid(data):
                return new HydratedPassBid(data)
            case isChooseAction(data):
                return new HydratedChooseAction(data)
            case isBuildTrack(data):
                return new HydratedBuildTrack(data)
            case isBuildConnection(data):
                return new HydratedBuildConnection(data)
            case isDelegateBuild(data):
                return new HydratedDelegateBuild(data)
            case isDevelop(data):
                return new HydratedDevelop(data)
            case isFinishDevelopment(data):
                return new HydratedFinishDevelopment(data)
            case isLeaveTown(data):
                return new HydratedLeaveTown(data)
            case isFoundSpecialConnection(data):
                return new HydratedFoundSpecialConnection(data)
            case isOfferShare(data):
                return new HydratedOfferShare(data)
            case isDeclineOffer(data):
                return new HydratedDeclineOffer(data)
            case isPayDividends(data):
                return new HydratedPayDividends(data)
            default:
                throw new Error(`Unknown action type ${data.type}`)
        }
    }

    hydrateState(state: SarGameState): HydratedSarGameState {
        return new HydratedSarGameState(state)
    }
}
