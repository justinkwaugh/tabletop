import { PlaceSpring } from '../actions/placeSpring.js'
import { RevealTiles } from '../actions/revealTiles.js'
import { PlaceBid } from '../actions/placeBid.js'
import { PlaceField } from '../actions/placeField.js'
import { PlaceNeutralTile } from '../actions/placeNeutralTile.js'
import { BuildCanal } from '../actions/buildCanal.js'
import { Pass } from '../actions/pass.js'
import { ProposeCanal } from '../actions/proposeCanal.js'
import { OverseerDecision } from '../actions/overseerDecision.js'
import { EndRoundEvent } from '../actions/endRoundEvent.js'
import { ActionType } from './actions.js'

export const SantiagoApiActions = {
    [ActionType.PlaceSpring]: PlaceSpring,
    [ActionType.RevealTiles]: RevealTiles,
    [ActionType.PlaceBid]: PlaceBid,
    [ActionType.PlaceField]: PlaceField,
    [ActionType.PlaceNeutralTile]: PlaceNeutralTile,
    [ActionType.BuildCanal]: BuildCanal,
    [ActionType.Pass]: Pass,
    [ActionType.ProposeCanal]: ProposeCanal,
    [ActionType.OverseerDecision]: OverseerDecision,
    [ActionType.EndRoundEvent]: EndRoundEvent
}
