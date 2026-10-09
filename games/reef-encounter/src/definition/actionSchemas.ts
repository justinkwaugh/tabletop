import type * as Type from 'typebox'
import { ChooseLarvaCubes } from '../actions/chooseLarvaCubes.js'
import { FeedParrotfish } from '../actions/feedParrotfish.js'
import { IntroduceShrimp } from '../actions/introduceShrimp.js'
import { MoveShrimp } from '../actions/moveShrimp.js'
import { PlacePolyp } from '../actions/placePolyp.js'
import { PlayLarvaCube } from '../actions/playLarvaCube.js'
import { RefillOpenSea } from '../actions/refillOpenSea.js'
import { TakeOpenSeaSpace } from '../actions/takeOpenSeaSpace.js'
import { ActionType } from './actions.js'

export const ReefEncounterActionSchemas = {
    [ActionType.FeedParrotfish]: FeedParrotfish,
    [ActionType.ChooseLarvaCubes]: ChooseLarvaCubes,
    [ActionType.PlayLarvaCube]: PlayLarvaCube,
    [ActionType.PlacePolyp]: PlacePolyp,
    [ActionType.IntroduceShrimp]: IntroduceShrimp,
    [ActionType.MoveShrimp]: MoveShrimp,
    [ActionType.TakeOpenSeaSpace]: TakeOpenSeaSpace,
    [ActionType.RefillOpenSea]: RefillOpenSea
} satisfies Record<ActionType, Type.TSchema>
