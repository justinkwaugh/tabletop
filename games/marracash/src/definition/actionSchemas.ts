import type * as Type from 'typebox'
import { BringVisitors } from '../actions/bringVisitors.js'
import { CompleteAntiqueSet } from '../actions/completeAntiqueSet.js'
import { EndTurn } from '../actions/endTurn.js'
import { MoveVisitors } from '../actions/moveVisitors.js'
import { PlaceBid } from '../actions/placeBid.js'
import { ResolveAuction } from '../actions/resolveAuction.js'
import { StartAuction } from '../actions/startAuction.js'
import { ActionType } from './actions.js'

export const MarracashActionSchemas = {
    [ActionType.StartAuction]: StartAuction,
    [ActionType.PlaceBid]: PlaceBid,
    [ActionType.ResolveAuction]: ResolveAuction,
    [ActionType.MoveVisitors]: MoveVisitors,
    [ActionType.CompleteAntiqueSet]: CompleteAntiqueSet,
    [ActionType.BringVisitors]: BringVisitors,
    [ActionType.EndTurn]: EndTurn
} satisfies Record<ActionType, Type.TSchema>
