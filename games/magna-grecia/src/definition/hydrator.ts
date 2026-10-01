import type { GameAction, GameHydrator, HydratedAction } from '@tabletop/common'
import {
    HydratedMagnaGreciaGameState,
    type MagnaGreciaProjectedState
} from '../model/gameState.js'
import { HydratedBuildMarket, isBuildMarket } from '../actions/buildMarket.js'
import { HydratedEndTurn, isEndTurn } from '../actions/endTurn.js'
import { HydratedPlaceCity, isPlaceCity } from '../actions/placeCity.js'
import { HydratedPlaceRoad, isPlaceRoad } from '../actions/placeRoad.js'
import { HydratedResupply, isResupply } from '../actions/resupply.js'
import { HydratedSellMarket, isSellMarket } from '../actions/sellMarket.js'

export class MagnaGreciaHydrator implements GameHydrator<
    MagnaGreciaProjectedState,
    HydratedMagnaGreciaGameState
> {
    hydrateAction(data: GameAction): HydratedAction {
        switch (true) {
            case isPlaceRoad(data):
                return new HydratedPlaceRoad(data)
            case isPlaceCity(data):
                return new HydratedPlaceCity(data)
            case isResupply(data):
                return new HydratedResupply(data)
            case isBuildMarket(data):
                return new HydratedBuildMarket(data)
            case isSellMarket(data):
                return new HydratedSellMarket(data)
            case isEndTurn(data):
                return new HydratedEndTurn(data)
            default:
                throw new Error(`Unknown action type ${data.type}`)
        }
    }

    hydrateState(state: MagnaGreciaProjectedState): HydratedMagnaGreciaGameState {
        return new HydratedMagnaGreciaGameState(state)
    }
}
