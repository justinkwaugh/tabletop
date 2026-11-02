import { HydratedPunctGameState, EndReason, Variant } from '../model/gameState.js'

export type TurnOutcome =
    | { kind: 'won'; winnerId: string; reason: EndReason }
    | { kind: 'drawn'; reason: EndReason }
    | { kind: 'next'; playerId: string; passedPlayerId?: string }

// Rule C and the agreed reading of it: any connection on the board ends the game at once,
// whoever's it is; if the move completed both, the mover's counts. Otherwise the game ends with
// a player's last piece: undecided in the basic game, by the central spaces in the standard
// game. A player who cannot act passes.
export function outcomeAfter(
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
    if (placed && state.getPlayerState(moverId).reserveSize() === 0) {
        return lastPieceOutcome(state, moverId)
    }
    if (state.canAct(opponentId)) {
        return { kind: 'next', playerId: opponentId }
    }
    if (state.canAct(moverId)) {
        return { kind: 'next', playerId: moverId, passedPlayerId: opponentId }
    }
    return { kind: 'drawn', reason: EndReason.NoMoves }
}

function lastPieceOutcome(state: HydratedPunctGameState, moverId: string): TurnOutcome {
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
