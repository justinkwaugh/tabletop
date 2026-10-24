import { isCrewVehicle, shipDefinition, ShipKind } from '../components/ships.js'
import { TechField } from '../components/techFields.js'
import { playerCapabilities, type Capabilities } from './capabilities.js'
import type { HydratedStellarHorizonsGameState } from './gameState.js'
import type { CompensationCounts } from './exploration.js'
import { type CombatLoss, MarkerReason, type ShipState } from './pieces.js'
import { awardTechMarkers, discardGoods, earnMarkers } from './pools.js'
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

// Engine Upgrades treat every ship as fast.
export function isFast(state: HydratedStellarHorizonsGameState, ship: ShipState): boolean {
    return shipDefinition(ship.shipId).fast || capabilitiesOf(state, ship.playerId).allShipsFast
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

// A ship's combat value wherever the rules ask for it (combat, blockades, the Syndicate's take):
// printed, less damage, at least 1 if armed, and Hypersonic Missiles' +1 for armed CVs.
export function combatValue(state: HydratedStellarHorizonsGameState, ship: ShipState): number {
    const combat = currentCombat(ship)
    return combat > 0 && isCrewVehicle(shipDefinition(ship.shipId))
        ? combat + capabilitiesOf(state, ship.playerId).armedCvCombat
        : combat
}

// The combined combat value of a Player's arrived ships in a system.
export function fleetCombatIn(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    systemId: string
): number {
    return state
        .shipsOf(playerId)
        .filter((ship) => ship.systemId === systemId && hasArrived(ship))
        .reduce((total, ship) => total + combatValue(state, ship), 0)
}

// A lost ship's goods go back to the pool, and its record of attacks goes with it.
export function removeShip(state: HydratedStellarHorizonsGameState, shipId: string) {
    const ship = state.ship(shipId)
    discardGoods(state, ship.playerId, ship.goods)
    state.attacks = state.attacks.filter((attack) => attack.shipId !== shipId)
    delete state.ships[shipId]
}

// Rulebook 1.4 and 1.6: 1 engineering marker for an RE; 1 biology marker and a quarter of its
// size in engineering markers for a CV.
function lossCompensation(ship: ShipState): CompensationCounts {
    const definition = shipDefinition(ship.shipId)
    return definition.kind === ShipKind.RE
        ? { [TechField.Engineering]: 1 }
        : { [TechField.Biology]: 1, [TechField.Engineering]: roundHalfUp(definition.size / 4) }
}

function compensationMarkers(ship: ShipState): [TechField, number][] {
    const compensation = lossCompensation(ship)
    const fields = [TechField.Biology, TechField.Engineering] as const
    return fields.flatMap((field): [TechField, number][] => {
        const count = compensation[field]
        return count === undefined ? [] : [[field, count]]
    })
}

// A ship lost on the Main Line draws its compensation at once.
export function loseShipNow(state: HydratedStellarHorizonsGameState, ship: ShipState): CombatLoss {
    const markers: CombatLoss['markers'] = []
    let cash = 0
    for (const [field, count] of compensationMarkers(ship)) {
        const award = awardTechMarkers(state, ship.playerId, field, count)
        markers.push({ field, values: award.markers })
        cash += award.cash
    }
    const loss = {
        shipId: ship.shipId,
        settlementsLost: ship.settlements,
        goodsLost: ship.goods.length,
        markers,
        cash
    }
    removeShip(state, ship.shipId)
    return loss
}

// Whether a ship's loss drew its owner compensation markers from the pool.
export function drewMarkers(loss: CombatLoss | undefined): boolean {
    return loss?.markers.some((award) => award.values.length > 0) ?? false
}

export function loseShip(state: HydratedStellarHorizonsGameState, ship: ShipState): ShipLoss {
    for (const [field, count] of compensationMarkers(ship)) {
        earnMarkers(state, ship.playerId, {
            shipId: ship.shipId,
            systemId: ship.systemId,
            field,
            count,
            reason: MarkerReason.Loss
        })
    }
    removeShip(state, ship.shipId)
    return {
        shipId: ship.shipId,
        settlementsLost: ship.settlements,
        compensation: lossCompensation(ship)
    }
}
