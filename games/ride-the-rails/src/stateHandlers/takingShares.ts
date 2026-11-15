import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { HydratedSkipShare, SkipShare, isSkipShare } from '../actions/skipShare.js'
import { HydratedTakeShare, isTakeShare } from '../actions/takeShare.js'
import { ActionType } from '../definition/actions.js'
import { PhaseName } from '../definition/phases.js'
import { MachineState } from '../definition/states.js'
import type { HydratedRideTheRailsGameState } from '../model/gameState.js'
import { mustSkipShare } from '../rules/shares.js'
import { endPhase, passTurn, startPhase, turnPlayerId } from './flow.js'

type ShareAction = HydratedTakeShare | HydratedSkipShare

// R-3.1: phase 1, in reverse turn order (R-2.2).
export class TakingSharesStateHandler implements MachineStateHandler<
    ShareAction,
    HydratedRideTheRailsGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedRideTheRailsGameState>
    ): action is ShareAction {
        return isTakeShare(action) || isSkipShare(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedRideTheRailsGameState>
    ): ActionType[] {
        return HydratedTakeShare.canTakeShare(context.gameState, playerId)
            ? [ActionType.TakeShare]
            : []
    }

    // R-3.1: a player who can take nothing skips their turn by itself.
    enter(context: MachineContext<HydratedRideTheRailsGameState>) {
        const state = context.gameState
        const playerId = turnPlayerId(state)
        state.activePlayerIds = [playerId]
        if (mustSkipShare(state)) {
            context.addSystemAction(SkipShare, { playerId })
        }
    }

    onAction(
        _action: ShareAction,
        context: MachineContext<HydratedRideTheRailsGameState>
    ): MachineState {
        const state = context.gameState
        if (passTurn(state, PhaseName.TakeShare)) {
            return MachineState.TakingShares
        }
        endPhase(state)
        startPhase(state, PhaseName.Build)
        return MachineState.Building
    }
}
