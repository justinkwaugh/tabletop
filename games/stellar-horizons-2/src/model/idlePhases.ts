import { attemptableSystemIds } from './anomalies.js'
import { canBuildAnyShip, canRepairAnyShip, cloningBases } from './building.js'
import { canTransferAnyCargo } from './cargoTransfer.js'
import { canDevelopAnyTech } from './development.js'
import { canExploreAnyShip } from './exploration.js'
import type { HydratedStellarHorizonsGameState } from './gameState.js'
import { attemptableEventIds } from './events.js'
import { canMoveAnyShip } from './movement.js'
import { canOperateAnyShip } from './operations.js'
import { canJoinAnyPact } from './pacts.js'
import { OperationKind } from './pieces.js'
import { shipTerraformSlots } from './terraforming.js'
import { canTransferAnyGoods, saleOptions } from './trade.js'
import { TurnPhase } from './turn.js'

// A phase ends by itself once the player can do nothing more in it. Exploring is the exception:
// the player ends the exploration phase themselves, having read the results.
export function isIdleInPhase(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    phase: TurnPhase
): boolean {
    switch (phase) {
        case TurnPhase.Build:
            return (
                !canBuildAnyShip(state, playerId) &&
                !canRepairAnyShip(state, playerId) &&
                cloningBases(state, playerId).length === 0
            )
        case TurnPhase.Cargo:
            return (
                !canTransferAnyCargo(state, playerId) &&
                !canTransferAnyGoods(state, playerId) &&
                saleOptions(state, playerId).length === 0
            )
        case TurnPhase.Movement:
            return !canMoveAnyShip(state, playerId)
        case TurnPhase.Exploration:
            return (
                !canExploreAnyShip(state, playerId) &&
                attemptableSystemIds(state, playerId).length === 0 &&
                attemptableEventIds(state, playerId).length === 0 &&
                !canJoinAnyPact(state, playerId) &&
                !canOperateAnyShip(state, playerId, OperationKind.Mining) &&
                !canOperateAnyShip(state, playerId, OperationKind.Research) &&
                !state
                    .shipsOf(playerId)
                    .some((ship) => shipTerraformSlots(state, ship).length > 0) &&
                !hasExploredThisDecade(state, playerId)
            )
        case TurnPhase.Development:
            return !canDevelopAnyTech(state, playerId)
        case TurnPhase.Initiative:
        case TurnPhase.BaseProduction:
        case TurnPhase.TradeGoods:
            return true
    }
}

function hasExploredThisDecade(state: HydratedStellarHorizonsGameState, playerId: string) {
    const player = state.getPlayerState(playerId)
    return (
        player.earnedMarkers.length > 0 ||
        player.anomalyAttempts.length > 0 ||
        player.operations.length > 0 ||
        player.shipTerraforms.length > 0 ||
        player.eventAttempts.length > 0
    )
}
