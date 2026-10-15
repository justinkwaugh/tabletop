import type * as Type from 'typebox'
import { ChooseLarvaCubes } from '../actions/chooseLarvaCubes.js'
import { EatCoral } from '../actions/eatCoral.js'
import { ExchangeConsumedPolyp } from '../actions/exchangeConsumedPolyp.js'
import { ExchangeLarvaCube } from '../actions/exchangeLarvaCube.js'
import { FeedParrotfish } from '../actions/feedParrotfish.js'
import { IntroduceShrimp } from '../actions/introduceShrimp.js'
import { MoveShrimp } from '../actions/moveShrimp.js'
import { PlacePolyp } from '../actions/placePolyp.js'
import { PlayAlgaCylinder } from '../actions/playAlgaCylinder.js'
import { EndGame } from '../actions/endGame.js'
import { PassFinalTurn } from '../actions/passFinalTurn.js'
import { PlayLarvaCube } from '../actions/playLarvaCube.js'
import { RefillOpenSea } from '../actions/refillOpenSea.js'
import { SearchBag } from '../actions/searchBag.js'
import { TakeOpenSeaSpace } from '../actions/takeOpenSeaSpace.js'
import { ActionType } from './actions.js'

export const ReefEncounterActionSchemas = {
    [ActionType.FeedParrotfish]: FeedParrotfish,
    [ActionType.ChooseLarvaCubes]: ChooseLarvaCubes,
    [ActionType.EatCoral]: EatCoral,
    [ActionType.PlayLarvaCube]: PlayLarvaCube,
    [ActionType.PlacePolyp]: PlacePolyp,
    [ActionType.IntroduceShrimp]: IntroduceShrimp,
    [ActionType.MoveShrimp]: MoveShrimp,
    [ActionType.ExchangeConsumedPolyp]: ExchangeConsumedPolyp,
    [ActionType.ExchangeLarvaCube]: ExchangeLarvaCube,
    [ActionType.PlayAlgaCylinder]: PlayAlgaCylinder,
    [ActionType.TakeOpenSeaSpace]: TakeOpenSeaSpace,
    [ActionType.PassFinalTurn]: PassFinalTurn,
    [ActionType.SearchBag]: SearchBag,
    [ActionType.RefillOpenSea]: RefillOpenSea,
    [ActionType.EndGame]: EndGame
} satisfies Record<ActionType, Type.TSchema>
