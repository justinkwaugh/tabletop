import { ActionType } from './actions.js'
import { PushPiece } from '../actions/pushPiece.js'
import { MovePotential } from '../actions/movePotential.js'
import { ExtraMove } from '../actions/extraMove.js'
import { SkipExtraMove } from '../actions/skipExtraMove.js'
import { RemoveRow } from '../actions/removeRow.js'
import { FinishRemoving } from '../actions/finishRemoving.js'

export const GipfPotentialsApiActions = {
    [ActionType.PushPiece]: PushPiece,
    [ActionType.MovePotential]: MovePotential,
    [ActionType.ExtraMove]: ExtraMove,
    [ActionType.SkipExtraMove]: SkipExtraMove,
    [ActionType.RemoveRow]: RemoveRow,
    [ActionType.FinishRemoving]: FinishRemoving
}
