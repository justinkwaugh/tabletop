import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { HydratedOathGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { HydratedResolveWake, ResolveWake, isResolveWake } from '../actions/resolveWake.js'
import { isPlayerActionOfType } from './handlerSupport.js'

/** R-4.1, R-X.1 — R-4.1.1's favor placement and R-4.1.4's site power are the player's decisions. */
export class WakePhaseStateHandler implements MachineStateHandler<
    HydratedAction,
    HydratedOathGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedOathGameState>
    ): boolean {
        return isPlayerActionOfType(action, ActionType.ResolveWake)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedOathGameState>
    ): string[] {
        return HydratedResolveWake.canDoResolveWake(context.gameState, playerId)
            ? [ActionType.ResolveWake]
            : []
    }

    enter(context: MachineContext<HydratedOathGameState>) {
        const gameState = context.gameState
        // The engine re-enters after every action, so the turn opens only once.
        if (!gameState.turnManager.currentTurn()) {
            const nextPlayerId = gameState.turnManager.startNextTurn(gameState.actionCount)
            gameState.activePlayerIds = [nextPlayerId]

            // R-4.3.4 — the saving is `supplyAtTurnStart − supplySpentThisTurn`, never the marker.
            const player = gameState.getPlayerState(nextPlayerId)
            player.supplyAtTurnStart = player.supply
            player.supplySpentThisTurn = 0

            if (HydratedResolveWake.nothingToDecide(gameState, nextPlayerId)) {
                context.addSystemAction(ResolveWake, { playerId: nextPlayerId, favorSteps: [] })
            }
        }
    }

    onAction(action: HydratedAction, context: MachineContext<HydratedOathGameState>): MachineState {
        if (isResolveWake(action)) {
            // R-4.1.2 may have ended the game before R-4.1.3 or R-4.1.4 ran.
            if (context.gameState.winningPlayerIds.length > 0) {
                return MachineState.EndOfGame
            }
            return MachineState.ActPhase
        }
        throw Error(`Unhandled action type: ${action.type}`)
    }
}
