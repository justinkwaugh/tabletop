import { GameAction, type GameHydrator, type HydratedAction } from '@tabletop/common'
import { HydratedBusGameState, BusGameState } from '../model/gameState.js'
import { HydratedPlaceBuilding, isPlaceBuilding } from '../actions/placeBuilding.js'
import { HydratedPlaceBusLine, isPlaceBusLine } from '../actions/placeBusLine.js'
import { HydratedChooseWorkerAction, isChooseWorkerAction } from '../actions/chooseWorkerAction.js'
import { HydratedPass, isPass } from '../actions/pass.js'

// This is essentially a factory that knows how to take raw action and state data
// and return the correct hydrated class instances for the Sample game.  Used by the game engine
export class BusHydrator implements GameHydrator<BusGameState, HydratedBusGameState> {
    hydrateAction(data: GameAction): HydratedAction {
        switch (true) {
            case isPlaceBuilding(data): {
                return new HydratedPlaceBuilding(data)
            }
            case isPlaceBusLine(data): {
                return new HydratedPlaceBusLine(data)
            }
            case isChooseWorkerAction(data): {
                return new HydratedChooseWorkerAction(data)
            }
            case isPass(data): {
                return new HydratedPass(data)
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
