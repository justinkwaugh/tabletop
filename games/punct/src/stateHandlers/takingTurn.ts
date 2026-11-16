import {
    assertExists,
    type HydratedAction,
    type MachineStateHandler,
    MachineContext
} from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { Variant } from '../definition/config.js'
import { HydratedPlacePiece, isPlacePiece } from '../actions/placePiece.js'
import { HydratedMovePiece, isMovePiece } from '../actions/movePiece.js'
import { EndReason, HydratedPunctGameState } from '../model/gameState.js'

type TakingTurnAction = HydratedPlacePiece | HydratedMovePiece

type TurnOutcome =
    | { kind: 'won'; winnerId: string; reason: EndReason }
    | { kind: 'drawn'; reason: EndReason }
    | { kind: 'next'; playerId: string; passedPlayerId?: string }

// Rule B: a turn adds a piece to the board or moves one already in play.
export class TakingTurnStateHandler implements MachineStateHandler<
    TakingTurnAction,
    HydratedPunctGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedPunctGameState>
    ): action is TakingTurnAction {
        return isPlacePiece(action) || isMovePiece(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedPunctGameState>
    ): ActionType[] {
        const { gameState } = context
        return [
            ...(gameState.canPlace(playerId) ? [ActionType.PlacePiece] : []),
            ...(gameState.canMove(playerId) ? [ActionType.MovePiece] : [])
        ]
    }

    enter(context: MachineContext<HydratedPunctGameState>) {
        const { gameState } = context
        const turn = gameState.turnManager.currentTurn()
        assertExists(turn, 'A turn is started before taking it')
        gameState.activePlayerIds = [turn.playerId]
    }

    onAction(
        action: TakingTurnAction,
        context: MachineContext<HydratedPunctGameState>
    ): MachineState {
        const { gameState } = context
        gameState.turnManager.endTurn(gameState.actionCount)
        const outcome = this.outcomeAfter(gameState, action.playerId, isPlacePiece(action))
        switch (outcome.kind) {
            case 'won':
                gameState.declareWinner(outcome.winnerId, outcome.reason)
                return MachineState.EndOfGame
            case 'drawn':
                gameState.declareDraw(outcome.reason)
                return MachineState.EndOfGame
            case 'next':
                if (outcome.passedPlayerId !== undefined) {
                    assertExists(action.metadata, 'An applied action records what it did')
                    action.metadata.passedPlayerId = outcome.passedPlayerId
                }
                gameState.turnManager.startTurn(outcome.playerId, gameState.actionCount)
                return MachineState.TakingTurn
        }
    }

    // Rule C and the agreed reading of it: any connection on the board ends the game at once,
    // whoever's it is; if the move completed both, the mover's counts. Otherwise the game ends with
    // a player's last piece: undecided in the basic game, by the central spaces in the standard
    // game. A player who cannot act passes, and if neither can, the game is drawn.
    private outcomeAfter(
        state: HydratedPunctGameState,
        moverId: string,
        placed: boolean
    ): TurnOutcome {
        const opponentId = state.opponentOf(moverId)
        const moverConnected = state.board.connection(moverId) !== undefined
        if (moverConnected || state.board.connection(opponentId) !== undefined) {
            return {
                kind: 'won',
                winnerId: moverConnected ? moverId : opponentId,
                reason: EndReason.Connection
            }
        }
        if (placed && state.reserveSize(moverId) === 0) {
            return this.lastPieceOutcome(state, moverId)
        }
        if (state.canAct(opponentId)) {
            return { kind: 'next', playerId: opponentId }
        }
        if (state.canAct(moverId)) {
            return { kind: 'next', playerId: moverId, passedPlayerId: opponentId }
        }
        return { kind: 'drawn', reason: EndReason.NoMoves }
    }

    private lastPieceOutcome(state: HydratedPunctGameState, moverId: string): TurnOutcome {
        if (state.variant === Variant.Basic) {
            return { kind: 'drawn', reason: EndReason.LastPiece }
        }
        const opponentId = state.opponentOf(moverId)
        const moverCount = state.board.centreCount(moverId)
        const opponentCount = state.board.centreCount(opponentId)
        if (moverCount === opponentCount) {
            return { kind: 'drawn', reason: EndReason.CentreCount }
        }
        return {
            kind: 'won',
            winnerId: moverCount > opponentCount ? moverId : opponentId,
            reason: EndReason.CentreCount
        }
    }
}
