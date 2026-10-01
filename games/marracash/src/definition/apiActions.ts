import { ActionType } from './actions.js'

import { PlaceBid } from '../actions/placeBid.js'
import { StartAuction } from '../actions/startAuction.js'
export const MarracashApiActions = {
    [ActionType.PlaceBid]: PlaceBid,
    [ActionType.StartAuction]: StartAuction
}
