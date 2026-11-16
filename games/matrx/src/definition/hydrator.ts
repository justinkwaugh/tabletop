import { GameAction, type GameHydrator, type HydratedAction } from '@tabletop/common'
import { HydratedMatrxGameState, MatrxGameState } from '../model/gameState.js'
import { HydratedPushPiece, isPushPiece } from '../actions/pushPiece.js'
import { HydratedMovePotential, isMovePotential } from '../actions/movePotential.js'
import { HydratedExtraMove, isExtraMove } from '../actions/extraMove.js'
import { HydratedSkipExtraMove, isSkipExtraMove } from '../actions/skipExtraMove.js'
import { HydratedRemoveRow, isRemoveRow } from '../actions/removeRow.js'

export class MatrxHydrator implements GameHydrator<MatrxGameState, HydratedMatrxGameState> {
    hydrateAction(data: GameAction): HydratedAction {
        switch (true) {
            case isPushPiece(data):
                return new HydratedPushPiece(data)
            case isMovePotential(data):
                return new HydratedMovePotential(data)
            case isExtraMove(data):
                return new HydratedExtraMove(data)
            case isSkipExtraMove(data):
                return new HydratedSkipExtraMove(data)
            case isRemoveRow(data):
                return new HydratedRemoveRow(data)
            default:
                throw new Error(`Unknown action type ${data.type}`)
        }
    }

    hydrateState(state: MatrxGameState): HydratedMatrxGameState {
        return new HydratedMatrxGameState(state)
    }
}
