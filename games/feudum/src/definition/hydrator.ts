import { GameAction, type GameHydrator, type HydratedAction } from '@tabletop/common'
import {
    HydratedChooseStartingGoods,
    isChooseStartingGoods
} from '../actions/chooseStartingGoods.js'
import { HydratedFinaliseHand, isFinaliseHand } from '../actions/finaliseHand.js'
import { HydratedForfeitCard, isForfeitCard } from '../actions/forfeitCard.js'
import { HydratedPlaceDisc, isPlaceDisc } from '../actions/placeDisc.js'
import { HydratedPlaceStartingPawn, isPlaceStartingPawn } from '../actions/placeStartingPawn.js'
import { HydratedPlayDefend, isPlayDefend } from '../actions/playDefend.js'
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
            case isForfeitCard(data): {
                return new HydratedForfeitCard(data)
            }
            case isPlayDefend(data): {
                return new HydratedPlayDefend(data)
            }
            case isPlaceDisc(data): {
                return new HydratedPlaceDisc(data)
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
