import { GameAction, type GameHydrator, type HydratedAction } from '@tabletop/common'
import { HydratedBuyShare, isBuyShare } from '../actions/buyShare.js'
import { HydratedRevealHand, isRevealHand } from '../actions/revealHand.js'
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
            default:
                throw new Error(`Unknown action type ${data.type}`)
        }
    }

    hydrateState(state: PromontoryPointProjectedState): HydratedPromontoryPointGameState {
        return new HydratedPromontoryPointGameState(state)
    }
}
