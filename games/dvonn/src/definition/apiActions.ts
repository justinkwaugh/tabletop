import { ActionType } from './actions.js'
import { PlacePiece } from '../actions/placePiece.js'
import { MoveStack } from '../actions/moveStack.js'
import { ChooseColor } from '../actions/chooseColor.js'

export const DvonnApiActions = {
    [ActionType.PlacePiece]: PlacePiece,
    [ActionType.MoveStack]: MoveStack,
    [ActionType.ChooseColor]: ChooseColor
}
