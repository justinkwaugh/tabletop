import { ActionType } from './actions.js'
import { ChooseLarvaCubes } from '../actions/chooseLarvaCubes.js'
import { FeedParrotfish } from '../actions/feedParrotfish.js'
import { TakeOpenSeaSpace } from '../actions/takeOpenSeaSpace.js'

export const ReefEncounterApiActions = {
    [ActionType.FeedParrotfish]: FeedParrotfish,
    [ActionType.ChooseLarvaCubes]: ChooseLarvaCubes,
    [ActionType.TakeOpenSeaSpace]: TakeOpenSeaSpace
}
