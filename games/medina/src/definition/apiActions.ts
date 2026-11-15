import { ActionType } from './actions.js'
import { PlaceBuilding } from '../actions/placeBuilding.js'
import { PlaceMerchant } from '../actions/placeMerchant.js'
import { PlaceRooftop } from '../actions/placeRooftop.js'
import { PlaceStable } from '../actions/placeStable.js'
import { PlaceWall } from '../actions/placeWall.js'
import { TakeTeaBreak } from '../actions/takeTeaBreak.js'

export const MedinaApiActions = {
    [ActionType.PlaceBuilding]: PlaceBuilding,
    [ActionType.PlaceRooftop]: PlaceRooftop,
    [ActionType.PlaceStable]: PlaceStable,
    [ActionType.PlaceMerchant]: PlaceMerchant,
    [ActionType.PlaceWall]: PlaceWall,
    [ActionType.TakeTeaBreak]: TakeTeaBreak
}
