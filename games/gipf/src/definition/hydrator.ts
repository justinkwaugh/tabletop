import { GameAction, type GameHydrator, type HydratedAction } from '@tabletop/common'
import { HydratedGipfGameState, GipfGameState } from '../model/gameState.js'
import { HydratedPushPiece, isPushPiece } from '../actions/pushPiece.js'
import { HydratedRemoveRow, isRemoveRow } from '../actions/removeRow.js'
import { HydratedFinishRemoving, isFinishRemoving } from '../actions/finishRemoving.js'

export class GipfHydrator implements GameHydrator<GipfGameState, HydratedGipfGameState> {
    hydrateAction(data: GameAction): HydratedAction {
        switch (true) {
            case isPushPiece(data):
                return new HydratedPushPiece(data)
            case isRemoveRow(data):
                return new HydratedRemoveRow(data)
            case isFinishRemoving(data):
                return new HydratedFinishRemoving(data)
            default:
                throw new Error(`Unknown action type ${data.type}`)
        }
    }

    hydrateState(state: GipfGameState): HydratedGipfGameState {
        return new HydratedGipfGameState(state)
    }
}
