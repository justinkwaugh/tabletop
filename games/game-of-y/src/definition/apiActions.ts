import { ActionType } from './actions.js'
import { PlaceStone } from '../actions/placeStone.js'
import { SwapColors } from '../actions/swapColors.js'

export const YApiActions = {
    [ActionType.PlaceStone]: PlaceStone,
    [ActionType.SwapColors]: SwapColors
}
