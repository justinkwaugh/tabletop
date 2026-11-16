import { assertExists } from '@tabletop/common'
import type { PhaseName } from '../definition/phases.js'
import type { HydratedRideTheRailsGameState } from '../model/gameState.js'
import { firstInPhase, nextInPhase } from '../rules/phaseOrder.js'

export function turnPlayerId(state: HydratedRideTheRailsGameState): string {
    const turn = state.turnManager.currentTurn()
    assertExists(turn, 'No turn is open')
    return turn.playerId
}

// R-2.2: ends the current turn and opens the next player's in the same phase, if one is left.
export function passTurn(state: HydratedRideTheRailsGameState, phase: PhaseName): boolean {
    const playerId = turnPlayerId(state)
    state.turnManager.endTurn(state.actionCount)
    const nextPlayerId = nextInPhase(state.turnManager.turnOrder, phase, playerId)
    if (nextPlayerId === undefined) {
        return false
    }
    state.turnManager.startTurn(nextPlayerId, state.actionCount + 1)
    return true
}

// R-2.1
export function endPhase(state: HydratedRideTheRailsGameState) {
    state.phaseManager.endPhase(state.actionCount)
}

// R-2.1, R-2.2: the next phase opens with the action after this one, at its first player's turn.
export function startPhase(state: HydratedRideTheRailsGameState, phase: PhaseName) {
    const start = state.actionCount + 1
    state.phaseManager.startPhase(phase, start)
    state.turnManager.startTurn(firstInPhase(state.turnManager.turnOrder, phase), start)
}
