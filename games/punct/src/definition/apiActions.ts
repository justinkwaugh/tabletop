import { ActionType } from './actions.js'
import { PlacePiece } from '../actions/placePiece.js'
import { MovePiece } from '../actions/movePiece.js'

export const PunctApiActions = {
    [ActionType.PlacePiece]: PlacePiece,
    [ActionType.MovePiece]: MovePiece
}
