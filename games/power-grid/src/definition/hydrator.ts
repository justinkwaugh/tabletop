import type { GameAction, GameHydrator, HydratedAction } from '@tabletop/common'
import { HydratedPowerGridGameState, type PowerGridProjectedState } from '../model/gameState.js'
import { HydratedBuildCities, isBuildCities } from '../actions/buildCities.js'
import { HydratedBuyResources, isBuyResources } from '../actions/buyResources.js'
import { HydratedChoosePlant, isChoosePlant } from '../actions/choosePlant.js'
import { HydratedCloseAuctions, isCloseAuctions } from '../actions/closeAuctions.js'
import { HydratedPassAuction, isPassAuction } from '../actions/passAuction.js'
import { HydratedPassBid, isPassBid } from '../actions/passBid.js'
import { HydratedPowerCities, isPowerCities } from '../actions/powerCities.js'
import { HydratedRaiseBid, isRaiseBid } from '../actions/raiseBid.js'
import { HydratedReplacePlant, isReplacePlant } from '../actions/replacePlant.js'
import { HydratedRestock, isRestock } from '../actions/restock.js'
import { HydratedScrapPlant, isScrapPlant } from '../actions/scrapPlant.js'
import { HydratedStartStep2, isStartStep2 } from '../actions/startStep2.js'

import { HydratedPlaceTrustHouse, isPlaceTrustHouse } from '../actions/placeTrustHouse.js'
import { HydratedTrustBuysResources, isTrustBuysResources } from '../actions/trustBuysResources.js'
import { HydratedTrustTakesPlant, isTrustTakesPlant } from '../actions/trustTakesPlant.js'

export class PowerGridHydrator implements GameHydrator<
    PowerGridProjectedState,
    HydratedPowerGridGameState
> {
    hydrateAction(data: GameAction): HydratedAction {
        switch (true) {
            case isPlaceTrustHouse(data):
                return new HydratedPlaceTrustHouse(data)
            case isTrustTakesPlant(data):
                return new HydratedTrustTakesPlant(data)
            case isTrustBuysResources(data):
                return new HydratedTrustBuysResources(data)
            case isChoosePlant(data):
                return new HydratedChoosePlant(data)
            case isPassAuction(data):
                return new HydratedPassAuction(data)
            case isRaiseBid(data):
                return new HydratedRaiseBid(data)
            case isPassBid(data):
                return new HydratedPassBid(data)
            case isReplacePlant(data):
                return new HydratedReplacePlant(data)
            case isScrapPlant(data):
                return new HydratedScrapPlant(data)
            case isCloseAuctions(data):
                return new HydratedCloseAuctions(data)
            case isBuyResources(data):
                return new HydratedBuyResources(data)
            case isBuildCities(data):
                return new HydratedBuildCities(data)
            case isStartStep2(data):
                return new HydratedStartStep2(data)
            case isPowerCities(data):
                return new HydratedPowerCities(data)
            case isRestock(data):
                return new HydratedRestock(data)
            default:
                throw new Error(`Unknown action type ${data.type}`)
        }
    }

    hydrateState(state: PowerGridProjectedState): HydratedPowerGridGameState {
        return new HydratedPowerGridGameState(state)
    }
}
