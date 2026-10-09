import { ActionType } from './actions.js'
import { ChooseLarvaCubes } from '../actions/chooseLarvaCubes.js'
import { FeedParrotfish } from '../actions/feedParrotfish.js'

export const ReefEncounterApiActions = {
    [ActionType.FeedParrotfish]: FeedParrotfish,
    [ActionType.ChooseLarvaCubes]: ChooseLarvaCubes
}
