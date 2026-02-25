import { GameAction, type GameHydrator, type HydratedAction } from '@tabletop/common'
import { HydratedIndonesiaGameState, IndonesiaGameState } from '../model/gameState.js'
import { HydratedPlaceCity, isPlaceCity } from '../actions/placeCity.js'
import { HydratedPass, isPass } from '../actions/pass.js'
import { HydratedPlaceCompanyDeeds, isPlaceCompanyDeeds } from '../actions/placeCompanyDeeds.js'
import { HydratedPlaceTurnOrderBid, isPlaceTurnOrderBid } from '../actions/placeTurnOrderBid.js'
import { HydratedSetTurnOrder, isSetTurnOrder } from '../actions/setTurnOrder.js'

// This is essentially a factory that knows how to take raw action and state data
// and return the correct hydrated class instances for the Sample game.  Used by the game engine
export class IndonesiaHydrator implements GameHydrator<
    IndonesiaGameState,
    HydratedIndonesiaGameState
> {
    hydrateAction(data: GameAction): HydratedAction {
        switch (true) {
            case isPlaceCompanyDeeds(data): {
                return new HydratedPlaceCompanyDeeds(data)
            }
            case isPlaceCity(data): {
                return new HydratedPlaceCity(data)
            }
            case isPass(data): {
                return new HydratedPass(data)
            }
            case isPlaceTurnOrderBid(data): {
                return new HydratedPlaceTurnOrderBid(data)
            }
            case isSetTurnOrder(data): {
                return new HydratedSetTurnOrder(data)
            }
            default: {
                throw new Error(`Unknown action type ${data.type}`)
            }
        }
    }

    hydrateState(state: IndonesiaGameState): HydratedIndonesiaGameState {
        return new HydratedIndonesiaGameState(state)
    }
}
