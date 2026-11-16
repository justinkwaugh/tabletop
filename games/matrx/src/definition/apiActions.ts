import { ActionType } from './actions.js'
import { PushPiece } from '../actions/pushPiece.js'
import { MovePotential } from '../actions/movePotential.js'
import { ExtraMove } from '../actions/extraMove.js'
import { SkipExtraMove } from '../actions/skipExtraMove.js'
import { RemoveRow } from '../actions/removeRow.js'

export const MatrxApiActions = {
    [ActionType.PushPiece]: PushPiece,
    [ActionType.MovePotential]: MovePotential,
    [ActionType.ExtraMove]: ExtraMove,
    [ActionType.SkipExtraMove]: SkipExtraMove,
    [ActionType.RemoveRow]: RemoveRow
}
