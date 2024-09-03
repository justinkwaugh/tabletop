import { ActionType } from './actions.js'
import { Pass } from '../actions/pass.js'
import { PlaceBid } from '../actions/placeBid.js'
import { PlaceHut } from '../actions/placeHut.js'
import { MoveGod } from '../actions/moveGod.js'

export const KaivaiApiActions = {
    [ActionType.Pass]: Pass,
    [ActionType.PlaceBid]: PlaceBid,
    [ActionType.PlaceHut]: PlaceHut,
    [ActionType.MoveGod]: MoveGod
}
