import { ActionType } from './actions.js'
import { PlaceArchitect } from '../actions/placeArchitect.js'
import { ChooseFirstPlayer } from '../actions/chooseFirstPlayer.js'
import { RepositionArchitect } from '../actions/repositionArchitect.js'
import { PlaceBuilding } from '../actions/placeBuilding.js'
import { Pass } from '../actions/pass.js'

export const UrbinoApiActions = {
    [ActionType.PlaceArchitect]: PlaceArchitect,
    [ActionType.ChooseFirstPlayer]: ChooseFirstPlayer,
    [ActionType.RepositionArchitect]: RepositionArchitect,
    [ActionType.PlaceBuilding]: PlaceBuilding,
    [ActionType.Pass]: Pass,
}
