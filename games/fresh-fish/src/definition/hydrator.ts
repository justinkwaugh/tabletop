import {
    GameAction,
    GameHydrator,
    GameState,
    type HydratedAction,
    type HydratedGameState
} from '@tabletop/common'
import { FreshFishGameState, HydratedFreshFishGameState } from '../model/gameState.js'

import { HydratedStartAuction, isStartAuction } from '../actions/startAuction.js'
import { HydratedDrawTile, isDrawTile } from '../actions/drawTile.js'
import { HydratedPlaceDisk, isPlaceDisk } from '../actions/placeDisk.js'
import { HydratedPlaceBid, isPlaceBid } from '../actions/placeBid.js'
import { HydratedPlaceMarket, isPlaceMarket } from '../actions/placeMarket.js'
import { HydratedPlaceStall, isPlaceStall } from '../actions/placeStall.js'
import { HydratedEndAuction, isEndAuction } from '../actions/endAuction.js'
import { HydratedPass, isPass } from '../actions/pass.js'

export class FreshFishHydrator implements GameHydrator {
    hydrateAction(data: GameAction): HydratedAction {
        switch (true) {
            case isStartAuction(data): {
                return new HydratedStartAuction(data)
            }
            case isDrawTile(data): {
                return new HydratedDrawTile(data)
            }
            case isPlaceDisk(data): {
                return new HydratedPlaceDisk(data)
            }
            case isPlaceBid(data): {
                return new HydratedPlaceBid(data)
            }
            case isPlaceMarket(data): {
                return new HydratedPlaceMarket(data)
            }
            case isPlaceStall(data): {
                return new HydratedPlaceStall(data)
            }
            case isEndAuction(data): {
                return new HydratedEndAuction(data)
            }
            case isPass(data): {
                return new HydratedPass(data)
            }
            default: {
                throw new Error(`Unknown action type ${data.type}`)
            }
        }
    }

    hydrateState(state: GameState): HydratedGameState {
        return new HydratedFreshFishGameState(state as FreshFishGameState)
    }
}
