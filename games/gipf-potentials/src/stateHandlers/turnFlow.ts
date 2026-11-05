import { assertExists } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { EndReason, HydratedGipfPotentialsGameState } from '../model/gameState.js'

// TAMSK, rules 3–4: a TAMSK-loaded piece pushed onto the centre earns its owner an extra move, at
// once for the mover (nothing is taken between the two moves, which are one turn), and to open
// the next turn for the opponent.
export function afterMove(
    state: HydratedGipfPotentialsGameState,
    playerId: string,
    tamskOwnerId: string | undefined
): MachineState {
    if (tamskOwnerId === playerId) {
        return MachineState.ExtraMove
    }
    if (tamskOwnerId !== undefined && !state.extraMoveOwedIds.includes(tamskOwnerId)) {
        state.extraMoveOwedIds.push(tamskOwnerId)
    }
    if (!state.movedThisTurn) {
        return beginRegularMove(state, playerId)
    }
    state.resolvingPlayerIds = [playerId, state.opponentOf(playerId)]
    return continueResolving(state)
}

// Rows go one at a time, the mover's first, and are found again after each, since a removal can
// uncover a piece that completes a new one. After the move the mover may also take rows of
// GIPF-pieces alone; anyone else takes only rows that must go.
export function continueResolving(state: HydratedGipfPotentialsGameState): MachineState {
    const turnPlayerId = currentPlayerId(state)
    while (state.resolvingPlayerIds.length > 0) {
        const resolverId = state.resolvingPlayerIds[0]
        const rows = state.board.rowsOf(resolverId)
        const mayTakeAny = state.movedThisTurn && resolverId === turnPlayerId
        const needsResolver = mayTakeAny
            ? rows.length > 0
            : rows.some((row) => state.board.isMandatory(row))
        if (needsResolver) {
            return MachineState.ResolvingRows
        }
        state.resolvingPlayerIds.shift()
    }
    return state.movedThisTurn ? endTurn(state, turnPlayerId) : beginTurn(state, turnPlayerId)
}

export function finishResolver(state: HydratedGipfPotentialsGameState): MachineState {
    state.resolvingPlayerIds.shift()
    return continueResolving(state)
}

function currentPlayerId(state: HydratedGipfPotentialsGameState): string {
    const playerId = state.turnManager.currentTurn()?.playerId
    assertExists(playerId, 'A turn is in progress')
    return playerId
}

// PÜNCT, rule 7: victory is checked at the end of a turn; a player left without a GIPF-piece
// uncovered loses, and if both are, the mover wins.
function endTurn(state: HydratedGipfPotentialsGameState, moverId: string): MachineState {
    const { turnManager } = state
    turnManager.endTurn(state.actionCount)
    const opponentId = state.opponentOf(moverId)
    const hasLostGipfPieces = (playerId: string) =>
        (!state.usesTournamentStart || state.hasMoved(playerId)) &&
        state.board.gipfPiecesOf(playerId) === 0
    if (hasLostGipfPieces(opponentId)) {
        state.declareWinner(moverId, EndReason.NoGipfPieces)
        return MachineState.EndOfGame
    }
    if (hasLostGipfPieces(moverId)) {
        state.declareWinner(opponentId, EndReason.NoGipfPieces)
        return MachineState.EndOfGame
    }
    turnManager.startNextTurn(state.actionCount)
    state.movedThisTurn = false
    return beginTurn(state, opponentId)
}

// A turn opens with the player's own rows that must go, then an extra move the opponent gave.
function beginTurn(state: HydratedGipfPotentialsGameState, playerId: string): MachineState {
    if (state.board.rowsOf(playerId).some((row) => state.board.isMandatory(row))) {
        state.resolvingPlayerIds = [playerId]
        return MachineState.ResolvingRows
    }
    const owed = state.extraMoveOwedIds.includes(playerId)
    state.extraMoveOwedIds = state.extraMoveOwedIds.filter((owedId) => owedId !== playerId)
    if (owed && state.ownTamskOnCentre(playerId)) {
        return MachineState.ExtraMove
    }
    return beginRegularMove(state, playerId)
}

// General use, rule 10: a player who can neither push a piece nor use a potential loses.
function beginRegularMove(state: HydratedGipfPotentialsGameState, playerId: string): MachineState {
    if (!state.canMove(playerId)) {
        state.declareWinner(state.opponentOf(playerId), EndReason.NoMoves)
        return MachineState.EndOfGame
    }
    return MachineState.TakingTurn
}
