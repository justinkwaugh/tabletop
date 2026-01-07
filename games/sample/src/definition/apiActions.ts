import { Pass } from '../actions/pass.js'
import { AddAmount } from '../actions/addAmount.js'
import { ActionType } from './actions.js'

// Define the mapping of action type names to their actual types.
// This is used by the backend to auto generate endpoints for every action with schema validation
export const SampleApiActions = {
    [ActionType.AddAmount]: AddAmount,
    [ActionType.Pass]: Pass
}
