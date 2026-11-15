import type { GameAction, GameHydrator, HydratedAction } from '@tabletop/common'
import { HydratedPlaceBuilding, isPlaceBuilding } from '../actions/placeBuilding.js'
import { HydratedPlaceMerchant, isPlaceMerchant } from '../actions/placeMerchant.js'
import { HydratedPlaceRooftop, isPlaceRooftop } from '../actions/placeRooftop.js'
import { HydratedPlaceStable, isPlaceStable } from '../actions/placeStable.js'
import { HydratedPlaceWall, isPlaceWall } from '../actions/placeWall.js'
import { HydratedTakeTeaBreak, isTakeTeaBreak } from '../actions/takeTeaBreak.js'
import { HydratedMedinaGameState, type MedinaProjectedState } from '../model/gameState.js'

export class MedinaHydrator implements GameHydrator<MedinaProjectedState, HydratedMedinaGameState> {
    hydrateAction(data: GameAction): HydratedAction {
        switch (true) {
            case isPlaceBuilding(data):
                return new HydratedPlaceBuilding(data)
            case isPlaceRooftop(data):
                return new HydratedPlaceRooftop(data)
            case isPlaceStable(data):
                return new HydratedPlaceStable(data)
            case isPlaceMerchant(data):
                return new HydratedPlaceMerchant(data)
            case isPlaceWall(data):
                return new HydratedPlaceWall(data)
            case isTakeTeaBreak(data):
                return new HydratedTakeTeaBreak(data)
            default:
                throw new Error(`Unknown action type ${data.type}`)
        }
    }

    hydrateState(state: MedinaProjectedState): HydratedMedinaGameState {
        return new HydratedMedinaGameState(state)
    }
}
