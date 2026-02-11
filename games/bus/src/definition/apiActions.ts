import { ActionType } from './actions.js'

import { Pass } from '../actions/pass.js'
import { ChooseWorkerAction } from '../actions/chooseWorkerAction.js'
import { PlaceBusLine } from '../actions/placeBusLine.js'
import { PlaceBuilding } from '../actions/placeBuilding.js'

// Define the mapping of action type names to their actual types.
// This is used by the backend to auto generate endpoints for every action with schema validation
export const BusApiActions = {

    [ActionType.Pass]: Pass,
    [ActionType.ChooseWorkerAction]: ChooseWorkerAction,
    [ActionType.PlaceBusLine]: PlaceBusLine,
    [ActionType.PlaceBuilding]: PlaceBuilding,}
