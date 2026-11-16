import { ActionType } from './actions.js'
import { PlacePiece } from '../actions/placePiece.js'
import { Capture } from '../actions/capture.js'
import { Stack } from '../actions/stack.js'
import { Pass } from '../actions/pass.js'

export const TzaarApiActions = {
    [ActionType.PlacePiece]: PlacePiece,
    [ActionType.Capture]: Capture,
    [ActionType.Stack]: Stack,
    [ActionType.Pass]: Pass
}
