import { GameAction, type GameHydrator, type HydratedAction } from '@tabletop/common'
import { HydratedUrbinoGameState, UrbinoGameState } from '../model/gameState.js'
import { HydratedPlaceArchitect, isPlaceArchitect } from '../actions/placeArchitect.js'
import { HydratedChooseFirstPlayer, isChooseFirstPlayer } from '../actions/chooseFirstPlayer.js'
import { HydratedRepositionArchitect, isRepositionArchitect } from '../actions/repositionArchitect.js'
import { HydratedPlaceBuilding, isPlaceBuilding } from '../actions/placeBuilding.js'
import { HydratedPass, isPass } from '../actions/pass.js'

export class UrbinoHydrator implements GameHydrator<UrbinoGameState, HydratedUrbinoGameState> {
    hydrateAction(data: GameAction): HydratedAction {
        switch (true) {
            case isPlaceArchitect(data):
                return new HydratedPlaceArchitect(data)
            case isChooseFirstPlayer(data):
                return new HydratedChooseFirstPlayer(data)
            case isRepositionArchitect(data):
                return new HydratedRepositionArchitect(data)
            case isPlaceBuilding(data):
                return new HydratedPlaceBuilding(data)
            case isPass(data):
                return new HydratedPass(data)
            default:
                throw new Error(`Unknown action type ${data.type}`)
        }
    }

    hydrateState(state: UrbinoGameState): HydratedUrbinoGameState {
        return new HydratedUrbinoGameState(state)
    }
}
