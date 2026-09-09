import type * as Type from 'typebox'
import { SolarFlare } from '../actions/solarFlare.js'
import { ActionType } from './actions.js'
import { SolApiActions } from './apiActions.js'

export const SolActionSchemas = {
    ...SolApiActions,
    [ActionType.SolarFlare]: SolarFlare
} satisfies Record<ActionType, Type.TSchema>
