import {
    assertExists,
    type HydratedAction,
    type MachineStateHandler,
    MachineContext
} from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedClaimColor, isClaimColor } from '../actions/claimColor.js'
import { HydratedMoveStack, isMoveStack } from '../actions/moveStack.js'
import { EndReason, HydratedLyngkGameState } from '../model/gameState.js'

type TakingTurnAction = HydratedClaimColor | HydratedMoveStack

function turnHolder(state: HydratedLyngkGameState): string {
    const turn = state.turnManager.currentTurn()
    assertExists(turn, 'A colour is claimed or a stack moved only during a turn')
    return turn.playerId
}

export class TakingTurnStateHandler implements MachineStateHandler<
    TakingTurnAction,
    HydratedLyngkGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedLyngkGameState>
    ): action is TakingTurnAction {
        return isClaimColor(action) || isMoveStack(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedLyngkGameState>
    ): ActionType[] {
        const { gameState } = context
        const canClaim = gameState.claimableColors(playerId).length > 0
        const canMove = gameState.hasMove(playerId)
        return [
            ...(canClaim ? [ActionType.ClaimColor] : []),
            ...(canMove ? [ActionType.MoveStack] : [])
        ]
    }

    enter(context: MachineContext<HydratedLyngkGameState>) {
        context.gameState.activePlayerIds = [turnHolder(context.gameState)]
    }

    onAction(
        action: TakingTurnAction,
        context: MachineContext<HydratedLyngkGameState>
    ): MachineState {
        const { gameState } = context
        if (isClaimColor(action)) {
            return MachineState.TakingTurn
        }
        assertExists(action.metadata, 'A moved stack records what it moved')
        const mover = turnHolder(gameState)
        gameState.claimedThisTurn = false
        gameState.turnManager.endTurn(gameState.actionCount)
        if (action.metadata.completedSix) {
            gameState.declareWinner(action.playerId, EndReason.StackOfSix)
            return MachineState.EndOfGame
        }
        const anyoneCanAct = gameState.players.some((player) => gameState.canAct(player.playerId))
        if (!anyoneCanAct) {
            gameState.declareWinnerByRanking()
            return MachineState.EndOfGame
        }
        // Rule E12: a player without a move passes and the other keeps playing.
        gameState.turnManager.startNextTurn(gameState.actionCount, (playerId) =>
            gameState.canAct(playerId)
        )
        if (turnHolder(gameState) === mover) {
            action.metadata.passedPlayerId = gameState.opponentOf(mover)
        }
        return MachineState.TakingTurn
    }
}
