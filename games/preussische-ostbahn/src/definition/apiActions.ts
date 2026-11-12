import { ActionType } from './actions.js'
import { Capitalize } from '../actions/capitalize.js'
import { BuildTrack } from '../actions/buildTrack.js'
import { EndExpansion } from '../actions/endExpansion.js'
import { PassBid } from '../actions/passBid.js'
import { PassTurn } from '../actions/passTurn.js'
import { PlaceBid } from '../actions/placeBid.js'

export const OstbahnApiActions = {
    [ActionType.PlaceBid]: PlaceBid,
    [ActionType.PassBid]: PassBid,
    [ActionType.Capitalize]: Capitalize,
    [ActionType.BuildTrack]: BuildTrack,
    [ActionType.EndExpansion]: EndExpansion,
    [ActionType.PassTurn]: PassTurn
}
