import { DrawRoof } from '../actions/drawRoof.js'
import { ActionType } from './actions.js'
import { StartAuction } from '../actions/startAuction.js'
import { PlaceBid } from '../actions/placeBid.js'
import { ChooseRecipient } from '../actions/chooseRecipient.js'
import { PlaceCube } from '../actions/placeCube.js'

export const EstatesApiActions = {
    [ActionType.DrawRoof]: DrawRoof,
    [ActionType.StartAuction]: StartAuction,
    [ActionType.PlaceBid]: PlaceBid,
    [ActionType.ChooseRecipient]: ChooseRecipient,
    [ActionType.PlaceCube]: PlaceCube
}
