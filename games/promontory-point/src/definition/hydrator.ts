import { GameAction, type GameHydrator, type HydratedAction } from '@tabletop/common'
import { HydratedBuyShare, isBuyShare } from '../actions/buyShare.js'
import { HydratedEndTurn, isEndTurn } from '../actions/endTurn.js'
import { HydratedPayRepairs, isPayRepairs } from '../actions/payRepairs.js'
import { HydratedPlaceTrack, isPlaceTrack } from '../actions/placeTrack.js'
import { HydratedRevealHand, isRevealHand } from '../actions/revealHand.js'
import { HydratedScrapTrack, isScrapTrack } from '../actions/scrapTrack.js'
import { HydratedSellShare, isSellShare } from '../actions/sellShare.js'
import {
    HydratedPromontoryPointGameState,
    PromontoryPointProjectedState
} from '../model/gameState.js'

export class PromontoryPointHydrator implements GameHydrator<
    PromontoryPointProjectedState,
    HydratedPromontoryPointGameState
> {
    hydrateAction(data: GameAction): HydratedAction {
        switch (true) {
            case isRevealHand(data):
                return new HydratedRevealHand(data)
            case isBuyShare(data):
                return new HydratedBuyShare(data)
            case isSellShare(data):
                return new HydratedSellShare(data)
            case isPlaceTrack(data):
                return new HydratedPlaceTrack(data)
            case isPayRepairs(data):
                return new HydratedPayRepairs(data)
            case isScrapTrack(data):
                return new HydratedScrapTrack(data)
            case isEndTurn(data):
                return new HydratedEndTurn(data)
            default:
                throw new Error(`Unknown action type ${data.type}`)
        }
    }

    hydrateState(state: PromontoryPointProjectedState): HydratedPromontoryPointGameState {
        return new HydratedPromontoryPointGameState(state)
    }
}
