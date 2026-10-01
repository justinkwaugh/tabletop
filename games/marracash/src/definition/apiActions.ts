import { ActionType } from './actions.js'

import { MoveVisitors } from '../actions/moveVisitors.js'
import { PlaceBid } from '../actions/placeBid.js'
import { StartAuction } from '../actions/startAuction.js'
export const MarracashApiActions = {
    [ActionType.MoveVisitors]: MoveVisitors,
    [ActionType.PlaceBid]: PlaceBid,
    [ActionType.StartAuction]: StartAuction
}
