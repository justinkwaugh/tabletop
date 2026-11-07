import { ActionType } from './actions.js'
import { PlaceMarble } from '../actions/placeMarble.js'
import { Capture } from '../actions/capture.js'

export const ZertzApiActions = {
    [ActionType.PlaceMarble]: PlaceMarble,
    [ActionType.Capture]: Capture
}
