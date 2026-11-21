import { GameAction, type GameHydrator, type HydratedAction } from '@tabletop/common'
import { HydratedLyngkGameState, LyngkGameState } from '../model/gameState.js'
import { HydratedClaimColor, isClaimColor } from '../actions/claimColor.js'
import { HydratedMoveStack, isMoveStack } from '../actions/moveStack.js'
import { HydratedPlacePiece, isPlacePiece } from '../actions/placePiece.js'

export class LyngkHydrator implements GameHydrator<LyngkGameState, HydratedLyngkGameState> {
    hydrateAction(data: GameAction): HydratedAction {
        switch (true) {
            case isClaimColor(data):
                return new HydratedClaimColor(data)
            case isMoveStack(data):
                return new HydratedMoveStack(data)
            case isPlacePiece(data):
                return new HydratedPlacePiece(data)
            default:
                throw new Error(`Unknown action type ${data.type}`)
        }
    }

    hydrateState(state: LyngkGameState): HydratedLyngkGameState {
        return new HydratedLyngkGameState(state)
    }
}
