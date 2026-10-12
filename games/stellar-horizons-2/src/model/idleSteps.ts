import { attemptableSystemIds } from './anomalies.js'
import { canTransferAnyCargo } from './cargoTransfer.js'
import { canExplore } from './exploration.js'
import type { HydratedStellarHorizonsGameState } from './gameState.js'
import { canMoveAnyShip } from './movement.js'
import { TurnStep, nextTurnStep } from './turn.js'

// The cargo and movement steps end by themselves when the player has nothing to do in them,
// and the exploration step is skipped when none of their ships can explore or resolve an
// anomaly. Exploring does not end the step, so the player can read the results before going on.
export function endIdleSteps(state: HydratedStellarHorizonsGameState, playerId: string) {
    const player = state.getPlayerState(playerId)
    while (isIdle(state, playerId, player.step)) {
        player.step = nextTurnStep(player.step)
    }
}

function isIdle(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    step: TurnStep
): boolean {
    switch (step) {
        case TurnStep.Cargo:
            return !canTransferAnyCargo(state, playerId)
        case TurnStep.Movement:
            return !canMoveAnyShip(state, playerId)
        case TurnStep.Exploration:
            return (
                !state.shipsOf(playerId).some((ship) => canExplore(state, ship)) &&
                attemptableSystemIds(state, playerId).length === 0
            )
        default:
            return false
    }
}
