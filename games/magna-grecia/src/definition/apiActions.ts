import { ActionType } from './actions.js'
import { BuildMarket } from '../actions/buildMarket.js'
import { EndTurn } from '../actions/endTurn.js'
import { PlaceCity } from '../actions/placeCity.js'
import { PlaceRoad } from '../actions/placeRoad.js'
import { Resupply } from '../actions/resupply.js'
import { SellMarket } from '../actions/sellMarket.js'

export const MagnaGreciaApiActions = {
    [ActionType.PlaceRoad]: PlaceRoad,
    [ActionType.PlaceCity]: PlaceCity,
    [ActionType.Resupply]: Resupply,
    [ActionType.BuildMarket]: BuildMarket,
    [ActionType.SellMarket]: SellMarket,
    [ActionType.EndTurn]: EndTurn
}
