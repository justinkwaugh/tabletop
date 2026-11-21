import { GameAction, type GameHydrator, type HydratedAction } from '@tabletop/common'
import { HydratedYGameState, YGameState } from '../model/gameState.js'
import { HydratedPlaceStone, isPlaceStone } from '../actions/placeStone.js'
import { HydratedSwapColors, isSwapColors } from '../actions/swapColors.js'

export class YHydrator implements GameHydrator<YGameState, HydratedYGameState> {
    hydrateAction(data: GameAction): HydratedAction {
        switch (true) {
            case isPlaceStone(data):
                return new HydratedPlaceStone(data)
            case isSwapColors(data):
                return new HydratedSwapColors(data)
            default:
                throw new Error(`Unknown action type ${data.type}`)
        }
    }

    hydrateState(state: YGameState): HydratedYGameState {
        return new HydratedYGameState(state)
    }
}
