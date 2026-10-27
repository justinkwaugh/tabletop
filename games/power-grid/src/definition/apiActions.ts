import { ActionType } from './actions.js'
import { BuildCities } from '../actions/buildCities.js'
import { BuyResources } from '../actions/buyResources.js'
import { ChoosePlant } from '../actions/choosePlant.js'
import { CloseAuctions } from '../actions/closeAuctions.js'
import { PassAuction } from '../actions/passAuction.js'
import { PassBid } from '../actions/passBid.js'
import { PowerCities } from '../actions/powerCities.js'
import { RaiseBid } from '../actions/raiseBid.js'
import { ReplacePlant } from '../actions/replacePlant.js'
import { Restock } from '../actions/restock.js'
import { ScrapPlant } from '../actions/scrapPlant.js'
import { StartStep2 } from '../actions/startStep2.js'

import { PlaceTrustHouse } from '../actions/placeTrustHouse.js'
import { TrustBuysResources } from '../actions/trustBuysResources.js'
import { TrustTakesPlant } from '../actions/trustTakesPlant.js'

export const PowerGridApiActions = {
    [ActionType.PlaceTrustHouse]: PlaceTrustHouse,
    [ActionType.TrustTakesPlant]: TrustTakesPlant,
    [ActionType.TrustBuysResources]: TrustBuysResources,
    [ActionType.ChoosePlant]: ChoosePlant,
    [ActionType.PassAuction]: PassAuction,
    [ActionType.RaiseBid]: RaiseBid,
    [ActionType.PassBid]: PassBid,
    [ActionType.ReplacePlant]: ReplacePlant,
    [ActionType.ScrapPlant]: ScrapPlant,
    [ActionType.CloseAuctions]: CloseAuctions,
    [ActionType.BuyResources]: BuyResources,
    [ActionType.BuildCities]: BuildCities,
    [ActionType.StartStep2]: StartStep2,
    [ActionType.PowerCities]: PowerCities,
    [ActionType.Restock]: Restock
}
