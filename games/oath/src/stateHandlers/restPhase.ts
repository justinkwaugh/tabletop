import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { HydratedOathGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { CompleteRest, HydratedCompleteRest, isCompleteRest } from '../actions/completeRest.js'
import { HydratedUseRestPower, isUseRestPower } from '../actions/useRestPower.js'
import { refreshSupply, returnFavorFromCards, returnSecretsToBoard } from '../util/rest.js'
import { isPlayerActionOfType } from './handlerSupport.js'
import { OathRevision, isAtLeastOathRevision } from '../util/revision.js'

// R-4.3 — `enter()` resolves R-4.3.1 to R-4.3.4, which hold no choice; R-4.3.5's Rest powers are actions.
export class RestPhaseStateHandler implements MachineStateHandler<
    HydratedAction,
    HydratedOathGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedOathGameState>
    ): boolean {
        return isPlayerActionOfType(action, ActionType.CompleteRest, ActionType.UseRestPower)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedOathGameState>
    ): string[] {
        const valid: string[] = []
        // R-4.3.5 — "Rest:" powers, once each, before the turn closes.
        if (HydratedUseRestPower.canDoUseRestPower(context.gameState, playerId)) {
            valid.push(ActionType.UseRestPower)
        }
        if (HydratedCompleteRest.canDoCompleteRest(context.gameState, playerId)) {
            valid.push(ActionType.CompleteRest)
        }
        return valid
    }

    enter(context: MachineContext<HydratedOathGameState>) {
        const gameState = context.gameState
        const turn = gameState.turnManager.currentTurn()
        if (!turn) return

        // The engine re-enters after a Rest power; a second refresh would inflate Supply.
        if (gameState.restResolvedForTurnStart !== turn.start) {
            gameState.restResolvedForTurnStart = turn.start
            // R-4.3.4 is folded into `refreshSupply` because it reads the marker R-4.3.3 overwrites.
            returnFavorFromCards(gameState)
            returnSecretsToBoard(gameState, turn.playerId)
            refreshSupply(gameState, turn.playerId)
        }

        if (isAtLeastOathRevision(gameState, OathRevision.TurnFlow)) {
            this.restWithoutAChoice(context, turn.playerId)
        }
    }

    /** R-4.3.5 — with no Rest power left to use, nothing waits on the player. */
    private restWithoutAChoice(context: MachineContext<HydratedOathGameState>, playerId: string) {
        if (HydratedUseRestPower.usableRestPowers(context.gameState, playerId).length > 0) return
        // The engine re-enters after every action, a System Action queued here included.
        if (context.getPendingActions().some(isCompleteRest)) return
        context.addSystemAction(CompleteRest, { playerId })
    }

    onAction(action: HydratedAction, context: MachineContext<HydratedOathGameState>): MachineState {
        if (isUseRestPower(action)) {
            // R-4.3.5 — any number, in any order; the Rest continues.
            return MachineState.RestPhase
        }
        if (isCompleteRest(action)) {
            // R-3.3 or R-3.4 may have ended the game at the round boundary.
            if (context.gameState.winningPlayerIds.length > 0) {
                return MachineState.EndOfGame
            }
            return action.metadata?.awaitsEndDie ? MachineState.EndOfRound : MachineState.WakePhase
        }
        throw Error(`Unhandled action type: ${action.type}`)
    }
}
