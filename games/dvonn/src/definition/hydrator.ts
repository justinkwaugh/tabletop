import { GameAction, type GameHydrator, type HydratedAction } from '@tabletop/common'
import { HydratedDvonnGameState, DvonnGameState } from '../model/gameState.js'
import { HydratedPlacePiece, isPlacePiece } from '../actions/placePiece.js'
import { HydratedMoveStack, isMoveStack } from '../actions/moveStack.js'
import { HydratedChooseColor, isChooseColor } from '../actions/chooseColor.js'

export class DvonnHydrator implements GameHydrator<DvonnGameState, HydratedDvonnGameState> {
    hydrateAction(data: GameAction): HydratedAction {
        switch (true) {
            case isPlacePiece(data):
                return new HydratedPlacePiece(data)
            case isMoveStack(data):
                return new HydratedMoveStack(data)
            case isChooseColor(data):
                return new HydratedChooseColor(data)
            default:
                throw new Error(`Unknown action type ${data.type}`)
        }
    }

    hydrateState(state: DvonnGameState): HydratedDvonnGameState {
        return new HydratedDvonnGameState(state)
    }
}
