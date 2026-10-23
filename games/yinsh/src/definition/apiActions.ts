import { ActionType } from './actions.js'
import { PlaceRing } from '../actions/placeRing.js'
import { MoveRing } from '../actions/moveRing.js'
import { RemoveRow } from '../actions/removeRow.js'
import { RemoveRing } from '../actions/removeRing.js'

export const YinshApiActions = {
    [ActionType.PlaceRing]: PlaceRing,
    [ActionType.MoveRing]: MoveRing,
    [ActionType.RemoveRow]: RemoveRow,
    [ActionType.RemoveRing]: RemoveRing
}
