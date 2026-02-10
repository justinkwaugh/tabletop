import { GameAction, type GameHydrator, type HydratedAction } from '@tabletop/common'
import { HydratedBusGameState, BusGameState } from '../model/gameState.js'
import { HydratedPlaceBuilding, isPlaceBuilding } from '../actions/placeBuilding.js'

// This is essentially a factory that knows how to take raw action and state data
// and return the correct hydrated class instances for the Sample game.  Used by the game engine
export class BusHydrator implements GameHydrator<BusGameState, HydratedBusGameState> {
    hydrateAction(data: GameAction): HydratedAction {
        switch (true) {
            case isPlaceBuilding(data): {
                return new HydratedPlaceBuilding(data)
            }
            default: {
                throw new Error(`Unknown action type ${data.type}`)
            }
        }
    }

    hydrateState(state: BusGameState): HydratedBusGameState {
        return new HydratedBusGameState(state)
    }
}
