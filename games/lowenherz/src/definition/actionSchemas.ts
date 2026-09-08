import type * as Type from 'typebox'
import { ActionType } from './actions.js'
import { LowenherzApiActions } from './apiActions.js'
import { AdvanceResolution } from '../actions/advanceResolution.js'

export const LowenherzActionSchemas = {
    ...LowenherzApiActions,
    [ActionType.AdvanceResolution]: AdvanceResolution
} satisfies Record<ActionType, Type.TSchema>
