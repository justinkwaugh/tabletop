import { FreshFishActionSchemas } from './actionSchemas.js'
import { ActionType } from './actions.js'

export const FreshFishApiActions = {
    [ActionType.DrawTile]: FreshFishActionSchemas[ActionType.DrawTile],
    [ActionType.PlaceBid]: FreshFishActionSchemas[ActionType.PlaceBid],
    [ActionType.PlaceDisk]: FreshFishActionSchemas[ActionType.PlaceDisk],
    [ActionType.PlaceMarket]: FreshFishActionSchemas[ActionType.PlaceMarket],
    [ActionType.PlaceStall]: FreshFishActionSchemas[ActionType.PlaceStall],
    [ActionType.Pass]: FreshFishActionSchemas[ActionType.Pass]
}
