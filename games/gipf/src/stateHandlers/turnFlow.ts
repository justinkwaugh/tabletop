import { MachineState } from '../definition/states.js'
import { GipfVersion } from '../definition/config.js'
import { EndReason, HydratedGipfGameState } from '../model/gameState.js'

// Rows are taken by their owner, the mover first; the opponent takes only rows that must go,
// and may take rows of GIPF-pieces at the start of their own turn.
export function startResolving(state: HydratedGipfGameState, moverId: string): MachineState {
    state.resolvingPlayerIds = [moverId, state.opponentOf(moverId)]
    return continueResolving(state)
}

export function continueResolving(state: HydratedGipfGameState): MachineState {
    while (state.resolvingPlayerIds.length > 0) {
        const resolverId = state.resolvingPlayerIds[0]
        const rows = state.board.rowsOf(resolverId)
        const needsResolver =
            resolverId === state.moverId
                ? rows.length > 0
                : rows.some((row) => state.board.isMandatory(row))
        if (needsResolver) {
            return MachineState.ResolvingRows
        }
        state.resolvingPlayerIds.shift()
    }
    return endTurn(state)
}

export function finishResolver(state: HydratedGipfGameState): MachineState {
    state.resolvingPlayerIds.shift()
    return continueResolving(state)
}

function endTurn(state: HydratedGipfGameState): MachineState {
    const { turnManager } = state
    const ended = turnManager.endTurn(state.actionCount)
    const moverId = ended.playerId
    const opponentId = state.opponentOf(moverId)

    if (state.rules.usesGipfPieces) {
        const hasLostGipfPieces = (playerId: string) =>
            (state.version !== GipfVersion.Tournament || state.hasMoved(playerId)) &&
            state.board.gipfPiecesOf(playerId) === 0
        if (hasLostGipfPieces(opponentId)) {
            state.declareWinner(moverId, EndReason.NoGipfPieces)
            return MachineState.EndOfGame
        }
        if (hasLostGipfPieces(moverId)) {
            state.declareWinner(opponentId, EndReason.NoGipfPieces)
            return MachineState.EndOfGame
        }
    }

    if (!state.canMove(opponentId)) {
        const hasPiece = state.canPlaySingle(opponentId) || state.canPlayGipf(opponentId)
        state.declareWinner(moverId, hasPiece ? EndReason.Blocked : EndReason.NoReserve)
        return MachineState.EndOfGame
    }

    turnManager.startNextTurn(state.actionCount)
    return MachineState.TakingTurn
}
