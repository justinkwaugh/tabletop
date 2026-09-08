import type * as Type from 'typebox'
import { EndAuction } from '../actions/endAuction.js'
import { EstatesApiActions } from './apiActions.js'
import { ActionType } from './actions.js'

export const EstatesActionSchemas = {
    ...EstatesApiActions,
    [ActionType.EndAuction]: EndAuction
} satisfies Record<ActionType, Type.TSchema>
