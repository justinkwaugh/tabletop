import { ActionType } from './actions.js'
import { ClaimColor } from '../actions/claimColor.js'
import { MoveStack } from '../actions/moveStack.js'

export const LyngkApiActions = {
    [ActionType.ClaimColor]: ClaimColor,
    [ActionType.MoveStack]: MoveStack
}
