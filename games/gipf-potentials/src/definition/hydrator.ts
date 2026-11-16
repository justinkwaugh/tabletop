import { GameAction, type GameHydrator, type HydratedAction } from '@tabletop/common'
import { HydratedGipfPotentialsGameState, GipfPotentialsGameState } from '../model/gameState.js'
import { HydratedPushPiece, isPushPiece } from '../actions/pushPiece.js'
import { HydratedMovePotential, isMovePotential } from '../actions/movePotential.js'
import { HydratedExtraMove, isExtraMove } from '../actions/extraMove.js'
import { HydratedSkipExtraMove, isSkipExtraMove } from '../actions/skipExtraMove.js'
import { HydratedRemoveRow, isRemoveRow } from '../actions/removeRow.js'
import { HydratedFinishRemoving, isFinishRemoving } from '../actions/finishRemoving.js'

export class GipfPotentialsHydrator implements GameHydrator<
    GipfPotentialsGameState,
    HydratedGipfPotentialsGameState
> {
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
            case isFinishRemoving(data):
                return new HydratedFinishRemoving(data)
            default:
                throw new Error(`Unknown action type ${data.type}`)
        }
    }

    hydrateState(state: GipfPotentialsGameState): HydratedGipfPotentialsGameState {
        return new HydratedGipfPotentialsGameState(state)
    }
}
