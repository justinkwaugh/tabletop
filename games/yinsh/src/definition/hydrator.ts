import { GameAction, type GameHydrator, type HydratedAction } from '@tabletop/common'
import { HydratedYinshGameState, YinshGameState } from '../model/gameState.js'
import { HydratedPlaceRing, isPlaceRing } from '../actions/placeRing.js'
import { HydratedMoveRing, isMoveRing } from '../actions/moveRing.js'
import { HydratedRemoveRow, isRemoveRow } from '../actions/removeRow.js'
import { HydratedRemoveRing, isRemoveRing } from '../actions/removeRing.js'

export class YinshHydrator implements GameHydrator<YinshGameState, HydratedYinshGameState> {
    hydrateAction(data: GameAction): HydratedAction {
        switch (true) {
            case isPlaceRing(data):
                return new HydratedPlaceRing(data)
            case isMoveRing(data):
                return new HydratedMoveRing(data)
            case isRemoveRow(data):
                return new HydratedRemoveRow(data)
            case isRemoveRing(data):
                return new HydratedRemoveRing(data)
            default:
                throw new Error(`Unknown action type ${data.type}`)
        }
    }

    hydrateState(state: YinshGameState): HydratedYinshGameState {
        return new HydratedYinshGameState(state)
    }
}
