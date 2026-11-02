import { GameAction, type GameHydrator, type HydratedAction } from '@tabletop/common'
import { HydratedPunctGameState, PunctGameState } from '../model/gameState.js'
import { HydratedPlacePiece, isPlacePiece } from '../actions/placePiece.js'
import { HydratedMovePiece, isMovePiece } from '../actions/movePiece.js'

export class PunctHydrator implements GameHydrator<PunctGameState, HydratedPunctGameState> {
    hydrateAction(data: GameAction): HydratedAction {
        switch (true) {
            case isPlacePiece(data):
                return new HydratedPlacePiece(data)
            case isMovePiece(data):
                return new HydratedMovePiece(data)
            default:
                throw new Error(`Unknown action type ${data.type}`)
        }
    }

    hydrateState(state: PunctGameState): HydratedPunctGameState {
        return new HydratedPunctGameState(state)
    }
}
