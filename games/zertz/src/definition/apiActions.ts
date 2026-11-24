import { ActionType } from './actions.js'
import { PlaceMarble } from '../actions/placeMarble.js'
import { Capture } from '../actions/capture.js'
import { SetAutoJump } from '../actions/setAutoJump.js'

export const ZertzApiActions = {
    [ActionType.PlaceMarble]: PlaceMarble,
    [ActionType.Capture]: Capture,
    [ActionType.SetAutoJump]: SetAutoJump
}
