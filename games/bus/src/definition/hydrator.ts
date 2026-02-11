import { GameAction, type GameHydrator, type HydratedAction } from '@tabletop/common'
import { HydratedBusGameState, BusGameState } from '../model/gameState.js'
import { HydratedPlaceBuilding, isPlaceBuilding } from '../actions/placeBuilding.js'
import { HydratedPlaceBusLine, isPlaceBusLine } from '../actions/placeBusLine.js'
import { HydratedChooseWorkerAction, isChooseWorkerAction } from '../actions/chooseWorkerAction.js'
import { HydratedPass, isPass } from '../actions/pass.js'
import { HydratedAddBus, isAddBus } from '../actions/addBus.js'
import { HydratedAddPassengers, isAddPassengers } from '../actions/addPassengers.js'
import { HydratedStopTime, isStopTime } from '../actions/stopTime.js'
import { HydratedRotateTime, isRotateTime } from '../actions/rotateTime.js'
import { HydratedVroom, isVroom } from '../actions/vroom.js'

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
            case isAddBus(data): {
                return new HydratedAddBus(data)
            }
            case isAddPassengers(data): {
                return new HydratedAddPassengers(data)
            }
            case isStopTime(data): {
                return new HydratedStopTime(data)
            }
            case isRotateTime(data): {
                return new HydratedRotateTime(data)
            }
            case isVroom(data): {
                return new HydratedVroom(data)
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
