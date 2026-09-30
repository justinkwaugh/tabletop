import {
    type HydratedAction,
    type MachineStateHandler,
    MachineContext,
    assertExists
} from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { HydratedOathGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { HydratedResolveOathkeeper, isResolveOathkeeper } from '../actions/resolveOathkeeper.js'
import { isPlayerActionOfType, returnClockToTurnPlayer } from './handlerSupport.js'

/** R-2.11.b — the outgoing Oathkeeper names the holder while the turn is held. */
export class OathkeeperChoiceStateHandler implements MachineStateHandler<
    HydratedAction,
    HydratedOathGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedOathGameState>
    ): boolean {
        return isPlayerActionOfType(action, ActionType.ResolveOathkeeper)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedOathGameState>
    ): string[] {
        return HydratedResolveOathkeeper.canDoResolveOathkeeper(context.gameState, playerId)
            ? [ActionType.ResolveOathkeeper]
            : []
    }

    enter(context: MachineContext<HydratedOathGameState>) {
        const pending = context.gameState.pendingOathkeeperChoice
        if (!pending) return
        context.gameState.activePlayerIds = [pending.holderPlayerId]
    }

    onAction(action: HydratedAction, context: MachineContext<HydratedOathGameState>): MachineState {
        if (isResolveOathkeeper(action)) {
            // Read from the action: the engine writes `machineState` only after this returns.
            assertExists(action.metadata, 'The Oathkeeper choice records where the turn resumes')
            returnClockToTurnPlayer(context.gameState)
            return action.metadata.resumeMachineState
        }
        throw Error(`Unhandled action type: ${action.type}`)
    }
}
