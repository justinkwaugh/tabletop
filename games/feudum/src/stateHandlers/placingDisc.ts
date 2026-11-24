import {
    assertExists,
    type HydratedAction,
    type MachineStateHandler,
    MachineContext
} from '@tabletop/common'
import { HydratedPlaceDisc, isPlaceDisc } from '../actions/placeDisc.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { currentFollowUp, followUpSeat } from '../model/followUps.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import { stateAfterCardStep } from './cardTurns.js'

/** R-4.7, R-4.9-H1, R-3.7.5 The follow-up's player places or keeps a disc. */
export class PlacingDiscStateHandler implements MachineStateHandler<
    HydratedPlaceDisc,
    HydratedFeudumGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedFeudumGameState>
    ): action is HydratedPlaceDisc {
        return isPlaceDisc(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedFeudumGameState>
    ): ActionType[] {
        const state = context.gameState
        return currentFollowUp(state) && followUpSeat(state) === playerId
            ? [ActionType.PlaceDisc]
            : []
    }

    enter(context: MachineContext<HydratedFeudumGameState>) {
        const state = context.gameState
        assertExists(currentFollowUp(state), 'R-4.7 A follow-up is being decided')
        state.activePlayerIds = [followUpSeat(state)]
    }

    onAction(
        _action: HydratedPlaceDisc,
        context: MachineContext<HydratedFeudumGameState>
    ): MachineState {
        return stateAfterCardStep(context)
    }
}
