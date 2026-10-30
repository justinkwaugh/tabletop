import { BuyShare } from '../actions/buyShare.js'
import { EndTurn } from '../actions/endTurn.js'
import { PayRepairs } from '../actions/payRepairs.js'
import { PlaceTrack } from '../actions/placeTrack.js'
import { RevealHand } from '../actions/revealHand.js'
import { ScrapTrack } from '../actions/scrapTrack.js'
import { SellShare } from '../actions/sellShare.js'
import { ActionType } from './actions.js'

export const PromontoryPointApiActions = {
    [ActionType.RevealHand]: RevealHand,
    [ActionType.BuyShare]: BuyShare,
    [ActionType.SellShare]: SellShare,
    [ActionType.PlaceTrack]: PlaceTrack,
    [ActionType.PayRepairs]: PayRepairs,
    [ActionType.ScrapTrack]: ScrapTrack,
    [ActionType.EndTurn]: EndTurn
}
