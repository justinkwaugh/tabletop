import { assertExists } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import type { HydratedCapture } from '../actions/capture.js'
import { HydratedTzaarGameState } from '../model/gameState.js'

// Rule G: a player who cannot make the forced capture when their turn begins has lost. The action
// that ends a turn records that player as its `stuckPlayerId`, and the turn start reads it.
export function stuckPlayerAfterTurnOf(
    state: HydratedTzaarGameState,
    moverId: string
): string | undefined {
    const nextId = state.opponentOf(moverId)
    return state.canCapture(nextId) ? undefined : nextId
}

// Rule D: White makes the first capture once the board is set.
export function stuckPlayerAtOpening(state: HydratedTzaarGameState): string | undefined {
    return stuckPlayerAfterTurnOf(state, state.opponentOf(state.whitePlayerId()))
}

// Rules D and E: White's opening capture is the whole turn; any other turn's first capture is
// followed by a second move unless nothing is left to make one with, and a second move ends it.
export function captureEndsTurn(
    state: HydratedTzaarGameState,
    { opening, noSecondMove }: { opening?: boolean; noSecondMove?: boolean }
): boolean {
    return (
        state.machineState === MachineState.SecondMove || opening === true || noSecondMove === true
    )
}

function startTurnOf(
    state: HydratedTzaarGameState,
    playerId: string,
    stuckPlayerId: string | undefined
): MachineState {
    if (stuckPlayerId === playerId) {
        state.declareWinner(state.opponentOf(playerId))
        return MachineState.EndOfGame
    }
    state.turnManager.startTurn(playerId, state.actionCount)
    return MachineState.Capturing
}

export function endTurnOf(
    state: HydratedTzaarGameState,
    moverId: string,
    stuckPlayerId: string | undefined
): MachineState {
    state.turnManager.endTurn(state.actionCount)
    return startTurnOf(state, state.opponentOf(moverId), stuckPlayerId)
}

// Rule D: White opens play.
export function beginPlay(
    state: HydratedTzaarGameState,
    stuckPlayerId: string | undefined
): MachineState {
    return startTurnOf(state, state.whitePlayerId(), stuckPlayerId)
}

export function activateCurrentPlayer(state: HydratedTzaarGameState) {
    const turn = state.turnManager.currentTurn()
    assertExists(turn, 'A turn is under way')
    state.activePlayerIds = [turn.playerId]
}

// Rule G: taking the last top piece of a type wins at once.
export function afterCapture(
    state: HydratedTzaarGameState,
    capture: HydratedCapture
): MachineState {
    const { metadata } = capture
    assertExists(metadata, 'A processed capture records its metadata')
    if (metadata.eliminatedKind !== undefined) {
        state.turnManager.endTurn(state.actionCount)
        state.declareWinner(capture.playerId)
        return MachineState.EndOfGame
    }
    if (captureEndsTurn(state, metadata)) {
        return endTurnOf(state, capture.playerId, metadata.stuckPlayerId)
    }
    return MachineState.SecondMove
}
