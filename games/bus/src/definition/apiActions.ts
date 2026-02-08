import { ActionType } from './actions.js'

import { PlaceBuilding } from '../actions/placeBuilding.js'

// Define the mapping of action type names to their actual types.
// This is used by the backend to auto generate endpoints for every action with schema validation
export const BusApiActions = {

    [ActionType.PlaceBuilding]: PlaceBuilding,}
