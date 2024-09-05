import { ActionType } from './actions.js'
import { Pass } from '../actions/pass.js'
import { PlaceBid } from '../actions/placeBid.js'
import { Build } from '../actions/build.js'
import { MoveGod } from '../actions/moveGod.js'
import { Fish } from '../actions/fish.js'
import { Deliver } from '../actions/deliver.js'
import { Celebrate } from '../actions/celebrate.js'
import { Increase } from '../actions/increase.js'
import { Move } from '../actions/move.js'

export const KaivaiApiActions = {
    [ActionType.Pass]: Pass,
    [ActionType.PlaceBid]: PlaceBid,
    [ActionType.Build]: Build,
    [ActionType.Fish]: Fish,
    [ActionType.Deliver]: Deliver,
    [ActionType.Celebrate]: Celebrate,
    [ActionType.Increase]: Increase,
    [ActionType.Move]: Move,
    [ActionType.MoveGod]: MoveGod
}
