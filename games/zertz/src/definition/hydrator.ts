import { GameAction, type GameHydrator, type HydratedAction } from '@tabletop/common'
import { HydratedZertzGameState, ZertzGameState } from '../model/gameState.js'
import { HydratedPlaceMarble, isPlaceMarble } from '../actions/placeMarble.js'
import { HydratedRemoveRing, isRemoveRing } from '../actions/removeRing.js'
import { HydratedCapture, isCapture } from '../actions/capture.js'

export class ZertzHydrator implements GameHydrator<ZertzGameState, HydratedZertzGameState> {
    hydrateAction(data: GameAction): HydratedAction {
        switch (true) {
            case isPlaceMarble(data):
                return new HydratedPlaceMarble(data)
            case isRemoveRing(data):
                return new HydratedRemoveRing(data)
            case isCapture(data):
                return new HydratedCapture(data)
            default:
                throw new Error(`Unknown action type ${data.type}`)
        }
    }

    hydrateState(state: ZertzGameState): HydratedZertzGameState {
        return new HydratedZertzGameState(state)
    }
}
