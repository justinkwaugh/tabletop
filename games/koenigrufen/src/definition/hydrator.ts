import { GameAction, type GameHydrator, type HydratedAction } from '@tabletop/common'
import { HydratedAnnounce, isAnnounce } from '../actions/announce.js'
import { HydratedBid, isBid } from '../actions/bid.js'
import { HydratedCallKing, isCallKing } from '../actions/callKing.js'
import { HydratedChooseContract, isChooseContract } from '../actions/chooseContract.js'
import { HydratedChooseTalonHalf, isChooseTalonHalf } from '../actions/chooseTalonHalf.js'
import { HydratedDealHand, isDealHand } from '../actions/dealHand.js'
import { HydratedEndHand, isEndHand } from '../actions/endHand.js'
import { HydratedGiveUp, isGiveUp } from '../actions/giveUp.js'
import { HydratedLayAway, isLayAway } from '../actions/layAway.js'
import { HydratedPass, isPass } from '../actions/pass.js'
import { HydratedPickUpTalon, isPickUpTalon } from '../actions/pickUpTalon.js'
import { HydratedPlayCard, isPlayCard } from '../actions/playCard.js'
import { HydratedRevealTalon, isRevealTalon } from '../actions/revealTalon.js'
import { HydratedSayMeinSpiel, isSayMeinSpiel } from '../actions/sayMeinSpiel.js'
import { HydratedKoenigrufenGameState, type KoenigrufenProjectedState } from '../model/gameState.js'

export class KoenigrufenHydrator implements GameHydrator<
    KoenigrufenProjectedState,
    HydratedKoenigrufenGameState
> {
    hydrateAction(data: GameAction): HydratedAction {
        switch (true) {
            case isDealHand(data):
                return new HydratedDealHand(data)
            case isSayMeinSpiel(data):
                return new HydratedSayMeinSpiel(data)
            case isBid(data):
                return new HydratedBid(data)
            case isPass(data):
                return new HydratedPass(data)
            case isChooseContract(data):
                return new HydratedChooseContract(data)
            case isCallKing(data):
                return new HydratedCallKing(data)
            case isRevealTalon(data):
                return new HydratedRevealTalon(data)
            case isChooseTalonHalf(data):
                return new HydratedChooseTalonHalf(data)
            case isGiveUp(data):
                return new HydratedGiveUp(data)
            case isPickUpTalon(data):
                return new HydratedPickUpTalon(data)
            case isLayAway(data):
                return new HydratedLayAway(data)
            case isAnnounce(data):
                return new HydratedAnnounce(data)
            case isPlayCard(data):
                return new HydratedPlayCard(data)
            case isEndHand(data):
                return new HydratedEndHand(data)
            default:
                throw new Error(`Unknown action type ${data.type}`)
        }
    }

    hydrateState(state: KoenigrufenProjectedState): HydratedKoenigrufenGameState {
        return new HydratedKoenigrufenGameState(state)
    }
}
