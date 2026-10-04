import { ActionType } from './actions.js'

import { BringVisitors } from '../actions/bringVisitors.js'
import { ConfirmTurn } from '../actions/confirmTurn.js'
import { MoveVisitors } from '../actions/moveVisitors.js'
import { PlaceBid } from '../actions/placeBid.js'
import { StartAuction } from '../actions/startAuction.js'
export const MarracashApiActions = {
    [ActionType.BringVisitors]: BringVisitors,
    [ActionType.ConfirmTurn]: ConfirmTurn,
    [ActionType.MoveVisitors]: MoveVisitors,
    [ActionType.PlaceBid]: PlaceBid,
    [ActionType.StartAuction]: StartAuction
}
