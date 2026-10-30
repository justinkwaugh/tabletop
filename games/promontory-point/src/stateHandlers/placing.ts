import {
    assert,
    assertExists,
    type HydratedAction,
    type MachineContext,
    type MachineStateHandler
} from '@tabletop/common'
import { isPlaceTrack, type HydratedPlaceTrack } from '../actions/placeTrack.js'
import { isScrapTrack, type HydratedScrapTrack } from '../actions/scrapTrack.js'
import type { ActionType } from '../definition/actions.js'
import type { MachineState } from '../definition/states.js'
import type { HydratedPromontoryPointGameState } from '../model/gameState.js'
import { turnPlayerId } from '../rules/turnPlayer.js'
import { placingHasEnded } from '../rules/placing.js'
import {
    activateTurnPlayer,
    availableActions,
    placingAvailability,
    stateAfterPlacingAction
} from './turnActions.js'

type PlacingAction = HydratedPlaceTrack | HydratedScrapTrack

// R-2.2 step 3, R-2.2-H1, R-3.3, R-3.3-H1: placements and scraps follow one another, trading closed.
export class PlacingStateHandler implements MachineStateHandler<
    PlacingAction,
    HydratedPromontoryPointGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedPromontoryPointGameState>
    ): action is PlacingAction {
        return isPlaceTrack(action) || isScrapTrack(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedPromontoryPointGameState>
    ): ActionType[] {
        const state = context.gameState
        if (playerId !== turnPlayerId(state)) {
            return []
        }
        return availableActions(placingAvailability(state, playerId))
    }

    enter(context: MachineContext<HydratedPromontoryPointGameState>) {
        const state = context.gameState
        assertExists(state.turn, 'A turn is under way while placing')
        assert(!placingHasEnded(state.turn), 'Placing goes on only while a placement is left')
        assert(state.pendingRepairs === undefined, 'Placing waits until every debtor has paid')
        activateTurnPlayer(state)
    }

    onAction(
        _action: PlacingAction,
        context: MachineContext<HydratedPromontoryPointGameState>
    ): MachineState {
        return stateAfterPlacingAction(context.gameState)
    }
}
