import { Pass } from '../actions/pass.js'
import { DrawTile } from '../actions/drawTile.js'
import { PlaceBid } from '../actions/placeBid.js'
import { PlaceDisk } from '../actions/placeDisk.js'
import { PlaceMarket } from '../actions/placeMarket.js'
import { PlaceStall } from '../actions/placeStall.js'
import { ActionType } from './actions.js'

export const FreshFishApiActions = {
    [ActionType.DrawTile]: DrawTile,
    [ActionType.PlaceBid]: PlaceBid,
    [ActionType.PlaceDisk]: PlaceDisk,
    [ActionType.PlaceMarket]: PlaceMarket,
    [ActionType.PlaceStall]: PlaceStall,
    [ActionType.Pass]: Pass
}
