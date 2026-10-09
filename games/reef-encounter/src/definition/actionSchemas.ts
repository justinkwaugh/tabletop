import type * as Type from 'typebox'
import { ChooseLarvaCubes } from '../actions/chooseLarvaCubes.js'
import { FeedParrotfish } from '../actions/feedParrotfish.js'
import { ActionType } from './actions.js'

export const ReefEncounterActionSchemas = {
    [ActionType.FeedParrotfish]: FeedParrotfish,
    [ActionType.ChooseLarvaCubes]: ChooseLarvaCubes
} satisfies Record<ActionType, Type.TSchema>
