import { ActionType } from './actions.js'
import { PlacePiece } from '../actions/placePiece.js'
import { MoveStack } from '../actions/moveStack.js'

export const DvonnApiActions = {
    [ActionType.PlacePiece]: PlacePiece,
    [ActionType.MoveStack]: MoveStack
}
