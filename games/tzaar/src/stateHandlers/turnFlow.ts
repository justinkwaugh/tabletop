import { MachineState } from '../definition/states.js'
import type { HydratedCapture } from '../actions/capture.js'
import { HydratedTzaarGameState } from '../model/gameState.js'

// Rule G: a player who cannot make the forced capture when their turn begins has lost.
export function stuckPlayerAfterTurnOf(
    state: HydratedTzaarGameState,
    moverId: string
): string | undefined {
    const nextId = state.opponentOf(moverId)
    return state.canCapture(nextId) ? undefined : nextId
}

function startTurnOf(state: HydratedTzaarGameState, playerId: string): MachineState {
    if (!state.canCapture(playerId)) {
        state.declareWinner(state.opponentOf(playerId))
        return MachineState.EndOfGame
    }
    state.turnManager.startTurn(playerId, state.actionCount)
    return MachineState.Capturing
}

export function endTurnOf(state: HydratedTzaarGameState, moverId: string): MachineState {
    state.turnManager.endTurn(state.actionCount)
    return startTurnOf(state, state.opponentOf(moverId))
}

// Rule D: White opens play.
export function beginPlay(state: HydratedTzaarGameState): MachineState {
    return startTurnOf(state, state.whitePlayerId())
}

export function activateCurrentPlayer(state: HydratedTzaarGameState) {
    const playerId = state.turnManager.currentTurn()?.playerId
    state.activePlayerIds = playerId === undefined ? [] : [playerId]
}

// Rule G: taking the last top piece of a type wins at once.
export function afterCapture(
    state: HydratedTzaarGameState,
    capture: HydratedCapture,
    next: () => MachineState
): MachineState {
    if (capture.metadata?.eliminatedKind !== undefined) {
        state.turnManager.endTurn(state.actionCount)
        state.declareWinner(capture.playerId)
        return MachineState.EndOfGame
    }
    return next()
}
