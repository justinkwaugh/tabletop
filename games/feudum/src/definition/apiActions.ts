import { ChooseStartingGoods } from '../actions/chooseStartingGoods.js'
import { FinaliseHand } from '../actions/finaliseHand.js'
import { ForfeitCard } from '../actions/forfeitCard.js'
import { PlaceDisc } from '../actions/placeDisc.js'
import { PlaceStartingPawn } from '../actions/placeStartingPawn.js'
import { PlayDefend } from '../actions/playDefend.js'
import { ActionType } from './actions.js'

// Define the mapping of action type names to their actual types.
// This is used by the backend to auto generate endpoints for every action with schema validation
export const FeudumApiActions = {
    [ActionType.ChooseStartingGoods]: ChooseStartingGoods,
    [ActionType.PlaceStartingPawn]: PlaceStartingPawn,
    [ActionType.FinaliseHand]: FinaliseHand,
    [ActionType.ForfeitCard]: ForfeitCard,
    [ActionType.PlayDefend]: PlayDefend,
    [ActionType.PlaceDisc]: PlaceDisc
}
