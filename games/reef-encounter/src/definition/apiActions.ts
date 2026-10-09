import { ActionType } from './actions.js'
import { ChooseLarvaCubes } from '../actions/chooseLarvaCubes.js'
import { EatCoral } from '../actions/eatCoral.js'
import { ExchangeConsumedPolyp } from '../actions/exchangeConsumedPolyp.js'
import { ExchangeLarvaCube } from '../actions/exchangeLarvaCube.js'
import { FeedParrotfish } from '../actions/feedParrotfish.js'
import { IntroduceShrimp } from '../actions/introduceShrimp.js'
import { MoveShrimp } from '../actions/moveShrimp.js'
import { PlacePolyp } from '../actions/placePolyp.js'
import { PlayLarvaCube } from '../actions/playLarvaCube.js'
import { TakeOpenSeaSpace } from '../actions/takeOpenSeaSpace.js'

export const ReefEncounterApiActions = {
    [ActionType.FeedParrotfish]: FeedParrotfish,
    [ActionType.ChooseLarvaCubes]: ChooseLarvaCubes,
    [ActionType.EatCoral]: EatCoral,
    [ActionType.PlayLarvaCube]: PlayLarvaCube,
    [ActionType.PlacePolyp]: PlacePolyp,
    [ActionType.IntroduceShrimp]: IntroduceShrimp,
    [ActionType.MoveShrimp]: MoveShrimp,
    [ActionType.ExchangeConsumedPolyp]: ExchangeConsumedPolyp,
    [ActionType.ExchangeLarvaCube]: ExchangeLarvaCube,
    [ActionType.TakeOpenSeaSpace]: TakeOpenSeaSpace
}
