import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { EndGame, HydratedEndGame, isEndGame } from '../actions/endGame.js'
import { EndRound, HydratedEndRound, isEndRound } from '../actions/endRound.js'
import type { ActionType } from '../definition/actions.js'
import { PhaseName } from '../definition/phases.js'
import { MachineState } from '../definition/states.js'
import type { HydratedRideTheRailsGameState } from '../model/gameState.js'
import { endPhase, startPhase } from './flow.js'

type EndingAction = HydratedEndRound | HydratedEndGame

// R-2.5, R-6.1: rounds 1 to 5 end with the end of round; round 6 ends the game instead.
export class EndingRoundStateHandler implements MachineStateHandler<
    EndingAction,
    HydratedRideTheRailsGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedRideTheRailsGameState>
    ): action is EndingAction {
        return isEndRound(action) || isEndGame(action)
    }

    validActionsForPlayer(
        _playerId: string,
        _context: MachineContext<HydratedRideTheRailsGameState>
    ): ActionType[] {
        return []
    }

    enter(context: MachineContext<HydratedRideTheRailsGameState>) {
        const state = context.gameState
        state.activePlayerIds = []
        if (HydratedEndRound.canEndRound(state)) {
            context.addSystemAction(EndRound, {})
        } else {
            context.addSystemAction(EndGame, {})
        }
    }

    // R-2.1, R-2.2: the next round opens with Take a Share, from the last in the new turn order.
    onAction(
        action: EndingAction,
        context: MachineContext<HydratedRideTheRailsGameState>
    ): MachineState {
        const state = context.gameState
        endPhase(state)
        if (action instanceof HydratedEndGame) {
            return MachineState.Ended
        }
        startPhase(state, PhaseName.TakeShare)
        return MachineState.TakingShares
    }
}
