import type * as Type from 'typebox'
import { DrawTile } from '../actions/drawTile.js'
import { EndAuction } from '../actions/endAuction.js'
import { Pass } from '../actions/pass.js'
import { PlaceBid } from '../actions/placeBid.js'
import { PlaceDisk } from '../actions/placeDisk.js'
import { PlaceMarket } from '../actions/placeMarket.js'
import { PlaceStall } from '../actions/placeStall.js'
import { StartAuction } from '../actions/startAuction.js'
import { ActionType } from './actions.js'

export const FreshFishActionSchemas = {
    [ActionType.StartAuction]: StartAuction,
    [ActionType.DrawTile]: DrawTile,
    [ActionType.PlaceBid]: PlaceBid,
    [ActionType.PlaceDisk]: PlaceDisk,
    [ActionType.PlaceMarket]: PlaceMarket,
    [ActionType.PlaceStall]: PlaceStall,
    [ActionType.EndAuction]: EndAuction,
    [ActionType.Pass]: Pass
} satisfies Record<ActionType, Type.TSchema>
