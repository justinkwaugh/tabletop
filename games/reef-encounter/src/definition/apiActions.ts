import { ActionType } from './actions.js'
import { ChooseLarvaCubes } from '../actions/chooseLarvaCubes.js'
import { FeedParrotfish } from '../actions/feedParrotfish.js'
import { PlacePolyp } from '../actions/placePolyp.js'
import { PlayLarvaCube } from '../actions/playLarvaCube.js'
import { TakeOpenSeaSpace } from '../actions/takeOpenSeaSpace.js'

export const ReefEncounterApiActions = {
    [ActionType.FeedParrotfish]: FeedParrotfish,
    [ActionType.ChooseLarvaCubes]: ChooseLarvaCubes,
    [ActionType.PlayLarvaCube]: PlayLarvaCube,
    [ActionType.PlacePolyp]: PlacePolyp,
    [ActionType.TakeOpenSeaSpace]: TakeOpenSeaSpace
}
