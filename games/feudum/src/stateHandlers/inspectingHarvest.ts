import {
    assertExists,
    type HydratedAction,
    type MachineStateHandler,
    MachineContext
} from '@tabletop/common'
import { HydratedChooseFavours, isChooseFavours } from '../actions/chooseFavours.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { followUpSeat } from '../model/followUps.js'
import { turnSeatsPending } from '../model/turns.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import { stateAfterCardStep } from './cardTurns.js'

/** R-3.11.3 The harvester sees the drawn goods and takes the favours from them, or none. */
export class InspectingHarvestStateHandler implements MachineStateHandler<
    HydratedChooseFavours,
    HydratedFeudumGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedFeudumGameState>
    ): action is HydratedChooseFavours {
        return isChooseFavours(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedFeudumGameState>
    ): ActionType[] {
        const state = context.gameState
        return turnSeatsPending(state, playerId, state.flow.harvest)
            ? [ActionType.ChooseFavours]
            : []
    }

    enter(context: MachineContext<HydratedFeudumGameState>) {
        const state = context.gameState
        assertExists(state.flow.harvest, 'R-3.11.3 A harvest is waiting')
        state.activePlayerIds = [followUpSeat(state)]
    }

    onAction(
        _action: HydratedChooseFavours,
        context: MachineContext<HydratedFeudumGameState>
    ): MachineState {
        return stateAfterCardStep(context)
    }
}
