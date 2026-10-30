import { BuyShare } from '../actions/buyShare.js'
import { PlaceTrack } from '../actions/placeTrack.js'
import { RevealHand } from '../actions/revealHand.js'
import { SellShare } from '../actions/sellShare.js'
import { ActionType } from './actions.js'

export const PromontoryPointApiActions = {
    [ActionType.RevealHand]: RevealHand,
    [ActionType.BuyShare]: BuyShare,
    [ActionType.SellShare]: SellShare,
    [ActionType.PlaceTrack]: PlaceTrack
}
