import { DrawRoof } from '../actions/drawRoof'
import { ActionType } from './actions'
import { StartAuction } from '../actions/startAuction'
import { PlaceBid } from '../actions/placeBid'
import { ChooseRecipient } from '../actions/chooseRecipient'
import { PlaceCube } from '../actions/placeCube'

export const EstatesApiActions = {
    [ActionType.DrawRoof]: DrawRoof,
    [ActionType.StartAuction]: StartAuction,
    [ActionType.PlaceBid]: PlaceBid,
    [ActionType.ChooseRecipient]: ChooseRecipient,
    [ActionType.PlaceCube]: PlaceCube
}
