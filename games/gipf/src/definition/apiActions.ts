import { ActionType } from './actions.js'
import { PushPiece } from '../actions/pushPiece.js'
import { RemoveRow } from '../actions/removeRow.js'
import { FinishRemoving } from '../actions/finishRemoving.js'

export const GipfApiActions = {
    [ActionType.PushPiece]: PushPiece,
    [ActionType.RemoveRow]: RemoveRow,
    [ActionType.FinishRemoving]: FinishRemoving
}
