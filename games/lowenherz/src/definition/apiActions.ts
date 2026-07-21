import { ActionType } from './actions.js'
import { PlaceCastle } from '../actions/placeCastle.js'
import { DrawActionCard } from '../actions/drawActionCard.js'
import { ChooseAction } from '../actions/chooseAction.js'
import { NegotiationMove } from '../actions/negotiationMove.js'
import { SubmitDuelBid } from '../actions/submitDuelBid.js'
import { PlaceWall } from '../actions/placeWall.js'
import { PlaceKnight } from '../actions/placeKnight.js'
import { ExpandRegion } from '../actions/expandRegion.js'
import { Pass } from '../actions/pass.js'
import { TakePoliticsCard } from '../actions/takePoliticsCard.js'
import { PlayRenegadeCard } from '../actions/playRenegadeCard.js'
import { PlayAllianceCard } from '../actions/playAllianceCard.js'
import { CancelAlliance } from '../actions/cancelAlliance.js'

// Define the mapping of action type names to their actual types.
// This is used by the backend to auto generate endpoints for every action with schema validation.
// AdvanceResolution is deliberately omitted - it's a system-only action, never
// submitted by a real client (see ResolvingActionsStateHandler).
export const LowenherzApiActions = {
    [ActionType.PlaceCastle]: PlaceCastle,
    [ActionType.DrawActionCard]: DrawActionCard,
    [ActionType.ChooseAction]: ChooseAction,
    [ActionType.NegotiationMove]: NegotiationMove,
    [ActionType.SubmitDuelBid]: SubmitDuelBid,
    [ActionType.PlaceWall]: PlaceWall,
    [ActionType.PlaceKnight]: PlaceKnight,
    [ActionType.ExpandRegion]: ExpandRegion,
    [ActionType.Pass]: Pass,
    [ActionType.TakePoliticsCard]: TakePoliticsCard,
    [ActionType.PlayRenegadeCard]: PlayRenegadeCard,
    [ActionType.PlayAllianceCard]: PlayAllianceCard,
    [ActionType.CancelAlliance]: CancelAlliance,
}
