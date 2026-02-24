import { ActionType } from './actions.js'

import { PlaceCompanyDeeds } from '../actions/placeCompanyDeeds.js'
import { PlaceCity } from '../actions/placeCity.js'
import { Pass } from '../actions/pass.js'

// Define the mapping of action type names to their actual types.
// This is used by the backend to auto generate endpoints for every action with schema validation
export const IndonesiaApiActions = {

    [ActionType.PlaceCompanyDeeds]: PlaceCompanyDeeds,
    [ActionType.PlaceCity]: PlaceCity,
    [ActionType.Pass]: Pass,}
