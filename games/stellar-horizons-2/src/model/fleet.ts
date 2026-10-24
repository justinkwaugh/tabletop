import { isCrewVehicle, shipDefinition, ShipKind } from '../components/ships.js'
import { TechField } from '../components/techFields.js'
import { playerCapabilities, type Capabilities } from './capabilities.js'
import type { HydratedStellarHorizonsGameState } from './gameState.js'
import type { CompensationCounts } from './exploration.js'
import { MarkerReason, type ShipState } from './pieces.js'
import { discardGoods, earnMarkers } from './pools.js'
import { roundHalfUp } from './turn.js'

export interface ShipLoss {
    shipId: string
    settlementsLost: number
    compensation: CompensationCounts
}

export function capabilitiesOf(
    state: HydratedStellarHorizonsGameState,
    playerId: string
): Capabilities {
    return playerCapabilities(
        state.getPlayerState(playerId),
        state.scenarioDefinition(),
        state.year
    )
}

export function cargoCapacity(state: HydratedStellarHorizonsGameState, ship: ShipState): number {
    const definition = shipDefinition(ship.shipId)
    if (definition.cargo === 0) {
        return 0
    }
    const capabilities = capabilitiesOf(state, ship.playerId)
    // Freight Haulers add to crew vehicles that carry cargo.
    const cvBonus = isCrewVehicle(definition) ? capabilities.cvCargoBonus : 0
    return definition.cargo + capabilities.cargoBonus + cvBonus
}

export function freeCargo(state: HydratedStellarHorizonsGameState, ship: ShipState): number {
    return cargoCapacity(state, ship) - ship.settlements - ship.goods.length
}

export function hasArrived(ship: ShipState): boolean {
    return ship.transit === 0
}

// The damage a ship takes before it is destroyed: a CV's size, one more with Reinforced Hulls.
export function damageCapacity(state: HydratedStellarHorizonsGameState, ship: ShipState): number {
    const definition = shipDefinition(ship.shipId)
    return isCrewVehicle(definition)
        ? definition.size + capabilitiesOf(state, ship.playerId).cvDamageBonus
        : definition.size
}

// Half the damage capacity, the modified one with Reinforced Hulls (designer ruling).
export function crippledThreshold(
    state: HydratedStellarHorizonsGameState,
    ship: ShipState
): number {
    return roundHalfUp(damageCapacity(state, ship) / 2)
}

export function isCrippled(state: HydratedStellarHorizonsGameState, ship: ShipState): boolean {
    return (
        isCrewVehicle(shipDefinition(ship.shipId)) && ship.damage >= crippledThreshold(state, ship)
    )
}

export function currentExploration(ship: ShipState): number {
    return Math.max(1, shipDefinition(ship.shipId).exploration - ship.damage)
}

export function currentCombat(ship: ShipState): number {
    const combat = shipDefinition(ship.shipId).combat
    return combat === 0 ? 0 : Math.max(1, combat - ship.damage)
}

// A lost ship's goods go back to the pool.
export function removeShip(state: HydratedStellarHorizonsGameState, shipId: string) {
    const ship = state.ship(shipId)
    discardGoods(state, ship.playerId, ship.goods)
    delete state.ships[shipId]
}

export function loseShip(state: HydratedStellarHorizonsGameState, ship: ShipState): ShipLoss {
    const definition = shipDefinition(ship.shipId)
    const compensation: CompensationCounts =
        definition.kind === ShipKind.RE
            ? { [TechField.Engineering]: 1 }
            : { [TechField.Biology]: 1, [TechField.Engineering]: roundHalfUp(definition.size / 4) }
    for (const field of [TechField.Biology, TechField.Engineering] as const) {
        const count = compensation[field]
        if (count !== undefined) {
            earnMarkers(state, ship.playerId, {
                shipId: ship.shipId,
                systemId: ship.systemId,
                field,
                count,
                reason: MarkerReason.Loss
            })
        }
    }
    removeShip(state, ship.shipId)
    return { shipId: ship.shipId, settlementsLost: ship.settlements, compensation }
}
