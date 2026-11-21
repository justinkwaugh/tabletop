import { ActionType } from './actions.js'
import { ClaimColor } from '../actions/claimColor.js'
import { MoveStack } from '../actions/moveStack.js'
import { PlacePiece } from '../actions/placePiece.js'

export const LyngkApiActions = {
    [ActionType.ClaimColor]: ClaimColor,
    [ActionType.MoveStack]: MoveStack,
    [ActionType.PlacePiece]: PlacePiece
}
