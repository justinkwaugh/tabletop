import { assertExists } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { EndReason, HydratedMatrxGameState } from '../model/gameState.js'

// Rule H1: a TAMSK stack pushed onto the centre earns its owner an extra move, at once for the
// mover (the moves between count as one turn), and to open the next turn for the opponent.
export function afterMove(
    state: HydratedMatrxGameState,
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

// Rules E6–E7: rows go one at a time, the mover's first; after each, rows are found again, since
// a removal can uncover a piece that completes a new one.
export function continueResolving(state: HydratedMatrxGameState): MachineState {
    const beaten = state.players.find((player) => state.gipfPiecesLeft(player.playerId) === 0)
    if (beaten !== undefined) {
        state.declareWinner(state.opponentOf(beaten.playerId), EndReason.NoGipfPieces)
        return MachineState.EndOfGame
    }
    while (state.resolvingPlayerIds.length > 0) {
        if (state.board.rowsOf(state.resolvingPlayerIds[0]).length > 0) {
            return MachineState.ResolvingRows
        }
        state.resolvingPlayerIds.shift()
    }
    const playerId = state.turnManager.currentTurn()?.playerId
    assertExists(playerId, 'A turn is in progress')
    return state.movedThisTurn ? endTurn(state, playerId) : beginTurn(state, playerId)
}

function endTurn(state: HydratedMatrxGameState, playerId: string): MachineState {
    const { turnManager } = state
    turnManager.endTurn(state.actionCount)
    turnManager.startNextTurn(state.actionCount)
    state.movedThisTurn = false
    return beginTurn(state, state.opponentOf(playerId))
}

// Rules E7 and H1: a turn opens with the player's own rows, then an extra move the opponent gave.
function beginTurn(state: HydratedMatrxGameState, playerId: string): MachineState {
    if (state.board.rowsOf(playerId).length > 0) {
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

// Rule I2: a player with no move left loses.
function beginRegularMove(state: HydratedMatrxGameState, playerId: string): MachineState {
    if (!state.canMove(playerId)) {
        state.declareWinner(state.opponentOf(playerId), EndReason.NoMoves)
        return MachineState.EndOfGame
    }
    return MachineState.TakingTurn
}
