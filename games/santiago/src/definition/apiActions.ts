import { PlaceBid } from '../actions/placeBid.js'
import { SelectTile } from '../actions/selectTile.js'
import { PlaceField } from '../actions/placeField.js'
import { PlaceNeutralTile } from '../actions/placeNeutralTile.js'
import { BuildCanal } from '../actions/buildCanal.js'
import { PayBribe } from '../actions/payBribe.js'
import { Pass } from '../actions/pass.js'
import { ProposeCanal } from '../actions/proposeCanal.js'
import { OverseerDecision } from '../actions/overseerDecision.js'
import { EndRoundEvent } from '../actions/endRoundEvent.js'
import { ActionType } from './actions.js'

export const SantiagoApiActions = {
    [ActionType.PlaceBid]: PlaceBid,
    [ActionType.SelectTile]: SelectTile,
    [ActionType.PlaceField]: PlaceField,
    [ActionType.PlaceNeutralTile]: PlaceNeutralTile,
    [ActionType.BuildCanal]: BuildCanal,
    [ActionType.PayBribe]: PayBribe,
    [ActionType.Pass]: Pass,
    [ActionType.ProposeCanal]: ProposeCanal,
    [ActionType.OverseerDecision]: OverseerDecision,
    [ActionType.EndRoundEvent]: EndRoundEvent
}
