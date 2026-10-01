import { GameAction, type GameHydrator, type HydratedAction } from '@tabletop/common'
import { HydratedMarracashGameState, type MarracashProjectedState } from '../model/gameState.js'
import { HydratedStartAuction, isStartAuction } from '../actions/startAuction.js'
import { HydratedPlaceBid, isPlaceBid } from '../actions/placeBid.js'
import { HydratedResolveAuction, isResolveAuction } from '../actions/resolveAuction.js'

export class MarracashHydrator implements GameHydrator<
    MarracashProjectedState,
    HydratedMarracashGameState
> {
    hydrateAction(data: GameAction): HydratedAction {
        switch (true) {
            case isStartAuction(data): {
                return new HydratedStartAuction(data)
            }
            case isPlaceBid(data): {
                return new HydratedPlaceBid(data)
            }
            case isResolveAuction(data): {
                return new HydratedResolveAuction(data)
            }
            default: {
                throw new Error(`Unknown action type ${data.type}`)
            }
        }
    }

    hydrateState(state: MarracashProjectedState): HydratedMarracashGameState {
        return new HydratedMarracashGameState(state)
    }
}
