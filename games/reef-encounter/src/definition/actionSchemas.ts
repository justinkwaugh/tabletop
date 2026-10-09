import type * as Type from 'typebox'
import { ChooseLarvaCubes } from '../actions/chooseLarvaCubes.js'
import { FeedParrotfish } from '../actions/feedParrotfish.js'
import { RefillOpenSea } from '../actions/refillOpenSea.js'
import { TakeOpenSeaSpace } from '../actions/takeOpenSeaSpace.js'
import { ActionType } from './actions.js'

export const ReefEncounterActionSchemas = {
    [ActionType.FeedParrotfish]: FeedParrotfish,
    [ActionType.ChooseLarvaCubes]: ChooseLarvaCubes,
    [ActionType.TakeOpenSeaSpace]: TakeOpenSeaSpace,
    [ActionType.RefillOpenSea]: RefillOpenSea
} satisfies Record<ActionType, Type.TSchema>
