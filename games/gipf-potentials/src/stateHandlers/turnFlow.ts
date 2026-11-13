import { assertExists } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { EndReason, HydratedGipfPotentialsGameState } from '../model/gameState.js'

// TAMSK, rules 3–4: a TAMSK-loaded piece pushed onto the centre earns its owner an extra move, at
// once for the mover (the two moves are one turn), and to open the next turn for the opponent.
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

// Rows are found again after each removal, which can uncover a piece completing a new one. A row
// of GIPF-pieces alone taken before the move leaves any row it frees for after the move.
export function continueResolving(state: HydratedGipfPotentialsGameState): MachineState {
    const turnPlayerId = currentPlayerId(state)
    while (state.resolvingPlayerIds.length > 0) {
        if (state.rowsToTake(state.resolvingPlayerIds[0]).length > 0) {
            return MachineState.ResolvingRows
        }
        state.resolvingPlayerIds.shift()
    }
    return state.movedThisTurn
        ? endTurn(state, turnPlayerId)
        : beginRegularMove(state, turnPlayerId)
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

// No row that must go stands as a turn begins: both players' are taken after every regular move.
function beginTurn(state: HydratedGipfPotentialsGameState, playerId: string): MachineState {
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
