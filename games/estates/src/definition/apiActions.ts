import { DrawRoof } from '../actions/drawRoof.js'
import { ActionType } from './actions.js'
import { StartAuction } from '../actions/startAuction.js'
import { PlaceBid } from '../actions/placeBid.js'
import { ChooseRecipient } from '../actions/chooseRecipient.js'
import { PlaceCube } from '../actions/placeCube.js'
import { PlaceMayor } from '../actions/placeMayor.js'
import { PlaceRoof } from '../actions/placeRoof.js'
import { PlaceBarrier } from '../actions/placeBarrier.js'
import { RemoveBarrier } from '../actions/removeBarrier.js'

export const EstatesApiActions = {
    [ActionType.DrawRoof]: DrawRoof,
    [ActionType.StartAuction]: StartAuction,
    [ActionType.PlaceBid]: PlaceBid,
    [ActionType.ChooseRecipient]: ChooseRecipient,
    [ActionType.PlaceCube]: PlaceCube,
    [ActionType.PlaceMayor]: PlaceMayor,
    [ActionType.PlaceRoof]: PlaceRoof,
    [ActionType.PlaceBarrier]: PlaceBarrier,
    [ActionType.RemoveBarrier]: RemoveBarrier
}
