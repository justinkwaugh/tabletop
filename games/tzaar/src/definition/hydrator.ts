import { GameAction, type GameHydrator, type HydratedAction } from '@tabletop/common'
import { HydratedTzaarGameState, TzaarGameState } from '../model/gameState.js'
import { HydratedPlacePiece, isPlacePiece } from '../actions/placePiece.js'
import { HydratedCapture, isCapture } from '../actions/capture.js'
import { HydratedStack, isStack } from '../actions/stack.js'
import { HydratedPass, isPass } from '../actions/pass.js'

export class TzaarHydrator implements GameHydrator<TzaarGameState, HydratedTzaarGameState> {
    hydrateAction(data: GameAction): HydratedAction {
        switch (true) {
            case isPlacePiece(data):
                return new HydratedPlacePiece(data)
            case isCapture(data):
                return new HydratedCapture(data)
            case isStack(data):
                return new HydratedStack(data)
            case isPass(data):
                return new HydratedPass(data)
            default:
                throw new Error(`Unknown action type ${data.type}`)
        }
    }

    hydrateState(state: TzaarGameState): HydratedTzaarGameState {
        return new HydratedTzaarGameState(state)
    }
}
