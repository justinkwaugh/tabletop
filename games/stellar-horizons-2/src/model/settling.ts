import { SOL_SYSTEM_ID } from '../components/systems.js'
import { isRevealedWorld } from '../components/worlds.js'
import { blocksBases } from './anomalies.js'
import { atBaseLimit, effectiveHabitability } from './campaign.js'
import { capabilitiesOf, freeCargo, hasArrived } from './fleet.js'
import type { HydratedStellarHorizonsGameState } from './gameState.js'
import { baseKey, type ShipState } from './pieces.js'

export function hasRevealedWorld(state: HydratedStellarHorizonsGameState, systemId: string) {
    return state.systemState(systemId).worlds.some((world) => isRevealedWorld(world.tileId))
}

export function canSettleSystem(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    systemId: string
): boolean {
    if (
        systemId === SOL_SYSTEM_ID ||
        !hasRevealedWorld(state, systemId) ||
        blocksBases(state, systemId)
    ) {
        return false
    }
    const threshold = capabilitiesOf(state, playerId).settleHabitability
    return threshold !== undefined && effectiveHabitability(state, playerId, systemId) >= threshold
}

export function settlementPurchaseLimit(
    state: HydratedStellarHorizonsGameState,
    ship: ShipState
): number {
    const capabilities = capabilitiesOf(state, ship.playerId)
    if (!capabilities.canBuySettlements || ship.systemId !== SOL_SYSTEM_ID || !hasArrived(ship)) {
        return 0
    }
    const cash = state.getPlayerState(ship.playerId).cash
    return Math.min(freeCargo(state, ship), Math.floor(cash / capabilities.settlementCost))
}

export function canLoadFromBase(state: HydratedStellarHorizonsGameState, ship: ShipState) {
    return (
        hasArrived(ship) &&
        !ship.loadedFromBase &&
        freeCargo(state, ship) > 0 &&
        state.base(ship.playerId, ship.systemId) !== undefined
    )
}

// In the campaign a new base may not exceed the faction's maximum for the century (1.8).
export function canUnload(state: HydratedStellarHorizonsGameState, ship: ShipState): boolean {
    return (
        hasArrived(ship) &&
        ship.settlements > 0 &&
        canSettleSystem(state, ship.playerId, ship.systemId) &&
        (state.base(ship.playerId, ship.systemId) !== undefined ||
            !atBaseLimit(state, ship.playerId))
    )
}

export function addSettlements(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    systemId: string,
    count: number
) {
    const base = state.base(playerId, systemId)
    if (base) {
        base.settlements += count
        return
    }
    state.bases[baseKey(playerId, systemId)] = {
        playerId,
        systemId,
        settlements: count,
        spent: 0,
        cloned: false
    }
}

export function removeBaseSettlement(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    systemId: string
) {
    const base = state.base(playerId, systemId)
    if (!base) {
        throw new Error(`No base for ${playerId} in ${systemId}`)
    }
    base.settlements -= 1
    if (base.settlements === 0) {
        delete state.bases[baseKey(playerId, systemId)]
    }
}
