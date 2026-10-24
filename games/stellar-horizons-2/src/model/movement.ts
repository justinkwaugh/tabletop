import { SOL_SYSTEM_ID, systemDistance } from '../components/systems.js'
import { isCrewVehicle, shipDefinition, ShipKind } from '../components/ships.js'
import { shipCost } from './building.js'
import { factionAbilities } from './campaign.js'
import { fastMovementModifier } from './capabilities.js'
import { capabilitiesOf, hasArrived, isFast } from './fleet.js'
import type { HydratedStellarHorizonsGameState } from './gameState.js'
import type { ShipState } from './pieces.js'

export interface MoveOption {
    systemId: string
    turns: number
}

export function shipRange(state: HydratedStellarHorizonsGameState, ship: ShipState): number {
    const capabilities = capabilitiesOf(state, ship.playerId)
    return isCrewVehicle(shipDefinition(ship.shipId)) ? capabilities.cvRange : capabilities.reRange
}

export function movementModifier(state: HydratedStellarHorizonsGameState, ship: ShipState) {
    const definition = shipDefinition(ship.shipId)
    const capabilities = capabilitiesOf(state, ship.playerId)
    if (definition.kind === ShipKind.RE) {
        return capabilities.reMovement
    }
    if (isFast(state, ship) && ship.settlements === 0) {
        return fastMovementModifier(capabilities.cvMovement)
    }
    return capabilities.cvMovement
}

// What a ship's moves depend on, worked out once per ship: its range, the systems it may trace
// range from, its movement modifier and the bases Stabilized Wormholes join.
interface ShipReach {
    range: number
    anchors: string[]
    modifier: number
    wormholeBases: string[]
}

function shipReach(state: HydratedStellarHorizonsGameState, ship: ShipState): ShipReach {
    const cost = shipCost(state, ship.playerId, ship.shipId)
    // The Starfarers' bases count as twice their size for extending range.
    const baseRange = factionAbilities(state, ship.playerId).baseRangeMultiplier ?? 1
    const bases = state.basesOf(ship.playerId)
    return {
        range: shipRange(state, ship),
        anchors: [
            SOL_SYSTEM_ID,
            ...bases
                .filter((base) => base.settlements * baseRange >= cost)
                .map((base) => base.systemId)
        ],
        modifier: movementModifier(state, ship),
        wormholeBases: capabilitiesOf(state, ship.playerId).wormholes
            ? bases.map((base) => base.systemId).filter((systemId) => systemId !== SOL_SYSTEM_ID)
            : []
    }
}

// Stabilized Wormholes make any two systems where the owner has bases one hex apart for their
// ships, Sol excepted (errata 4); a trip may take that hop once on its way.
function reachDistance(reach: ShipReach, fromSystemId: string, toSystemId: string): number {
    let best = systemDistance(fromSystemId, toSystemId)
    for (const entry of reach.wormholeBases) {
        for (const exit of reach.wormholeBases) {
            if (entry !== exit) {
                best = Math.min(
                    best,
                    systemDistance(fromSystemId, entry) + 1 + systemDistance(exit, toSystemId)
                )
            }
        }
    }
    return best
}

function reachesSystem(reach: ShipReach, systemId: string): boolean {
    return reach.anchors.some((anchor) => reachDistance(reach, anchor, systemId) <= reach.range)
}

function reachTime(reach: ShipReach, fromSystemId: string, systemId: string): number {
    return Math.max(1, Math.ceil(reachDistance(reach, fromSystemId, systemId) * reach.modifier))
}

export function isWithinRange(
    state: HydratedStellarHorizonsGameState,
    ship: ShipState,
    systemId: string
): boolean {
    return reachesSystem(shipReach(state, ship), systemId)
}

export function travelTime(
    state: HydratedStellarHorizonsGameState,
    ship: ShipState,
    systemId: string
): number {
    return reachTime(shipReach(state, ship), ship.systemId, systemId)
}

export function moveOptions(
    state: HydratedStellarHorizonsGameState,
    ship: ShipState
): MoveOption[] {
    if (!hasArrived(ship)) {
        return []
    }
    const reach = shipReach(state, ship)
    return state.systems
        .map((system) => system.systemId)
        .filter((systemId) => systemId !== ship.systemId && reachesSystem(reach, systemId))
        .map((systemId) => ({ systemId, turns: reachTime(reach, ship.systemId, systemId) }))
}

export function canMoveAnyShip(state: HydratedStellarHorizonsGameState, playerId: string): boolean {
    return state.shipsOf(playerId).some((ship) => moveOptions(state, ship).length > 0)
}
