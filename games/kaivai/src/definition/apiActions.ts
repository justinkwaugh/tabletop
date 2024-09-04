import { ActionType } from './actions.js'
import { Pass } from '../actions/pass.js'
import { PlaceBid } from '../actions/placeBid.js'
import { Build } from '../actions/build.js'
import { MoveGod } from '../actions/moveGod.js'
import { Fish } from '../actions/fish.js'

export const KaivaiApiActions = {
    [ActionType.Pass]: Pass,
    [ActionType.PlaceBid]: PlaceBid,
    [ActionType.Build]: Build,
    [ActionType.Fish]: Fish,
    [ActionType.MoveGod]: MoveGod
}
