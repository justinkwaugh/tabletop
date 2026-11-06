import { GameAction, type GameHydrator, type HydratedAction } from '@tabletop/common'
import {
    HydratedChooseStartingGoods,
    isChooseStartingGoods
} from '../actions/chooseStartingGoods.js'
import { HydratedFinaliseHand, isFinaliseHand } from '../actions/finaliseHand.js'
import { HydratedPlaceStartingPawn, isPlaceStartingPawn } from '../actions/placeStartingPawn.js'
import { HydratedFeudumGameState, type FeudumProjectedState } from '../model/gameState.js'

export class FeudumHydrator implements GameHydrator<FeudumProjectedState, HydratedFeudumGameState> {
    hydrateAction(data: GameAction): HydratedAction {
        switch (true) {
            case isChooseStartingGoods(data): {
                return new HydratedChooseStartingGoods(data)
            }
            case isPlaceStartingPawn(data): {
                return new HydratedPlaceStartingPawn(data)
            }
            case isFinaliseHand(data): {
                return new HydratedFinaliseHand(data)
            }
            default: {
                throw new Error(`Unknown action type ${data.type}`)
            }
        }
    }

    hydrateState(state: FeudumProjectedState): HydratedFeudumGameState {
        return new HydratedFeudumGameState(state)
    }
}
