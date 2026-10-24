import { SOL_SYSTEM_ID } from '../components/systems.js'
import {
    factionShips,
    isCrewVehicle,
    shipDefinition,
    ShipKind,
    type ShipDefinition
} from '../components/ships.js'
import { baseEffects, blocksBases } from './anomalies.js'
import { atCrewVehicleLimit, atShipLimit } from './campaign.js'
import { MIN_PRICE } from './capabilities.js'
import { capabilitiesOf, hasArrived } from './fleet.js'
import type { HydratedStellarHorizonsGameState } from './gameState.js'
import type { ShipState } from './pieces.js'
import { roundHalfUp } from './turn.js'

export const DOCK_REPAIR_COST = 1
export const REMOTE_REPAIR_POINT_COST = 3
export const CLONING_COST = 5

// Cyborg Species make cloning cheaper.
export function cloningCost(state: HydratedStellarHorizonsGameState, playerId: string): number {
    return capabilitiesOf(state, playerId).cloningCost ?? CLONING_COST
}

export enum RepairMethod {
    Dock = 'Dock',
    RemotePoint = 'RemotePoint',
    RemoteFull = 'RemoteFull'
}

export function shipsAvailableToBuild(
    state: HydratedStellarHorizonsGameState,
    playerId: string
): ShipDefinition[] {
    const faction = state.getPlayerState(playerId).faction
    if (!faction || atShipLimit(state, playerId)) {
        return []
    }
    const maxSize = capabilitiesOf(state, playerId).cvMaxSize
    const crewVehicles = !atCrewVehicleLimit(state, playerId)
    return factionShips(faction).filter(
        (definition) =>
            !state.findShip(definition.id) &&
            (definition.kind === ShipKind.RE || (crewVehicles && definition.size <= maxSize))
    )
}

// Crew Focus, Robotic Focus and Engine Upgrades change what a ship costs to buy, and with it the
// base size a build and range need (designer ruling), never below $1B; repairs and scrap
// refunds keep the printed cost.
export function shipCost(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    shipId: string
): number {
    const definition = shipDefinition(shipId)
    const capabilities = capabilitiesOf(state, playerId)
    const change =
        (isCrewVehicle(definition) ? capabilities.cvCostChange : capabilities.reCostChange) +
        (definition.fast ? capabilities.fastShipCostChange : 0)
    return change === 0 ? definition.cost : Math.max(MIN_PRICE, definition.cost + change)
}

// Nanobot Swarm's back makes ships built at a base in its system $1B cheaper.
export function buildCost(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    shipId: string,
    systemId: string
): number {
    const reduction =
        systemId === SOL_SYSTEM_ID ? 0 : (baseEffects(state, systemId).shipCostReduction ?? 0)
    return Math.max(0, shipCost(state, playerId, shipId) - reduction)
}

export function buildLocations(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    shipId: string
): string[] {
    const cost = shipCost(state, playerId, shipId)
    const bases = state
        .basesOf(playerId)
        .filter(
            (base) =>
                base.settlements >= cost &&
                base.spent + buildCost(state, playerId, shipId, base.systemId) <= base.settlements
        )
        .map((base) => base.systemId)
    return [SOL_SYSTEM_ID, ...bases]
}

export function canBuildShip(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    shipId: string,
    systemId: string
): boolean {
    return (
        shipsAvailableToBuild(state, playerId).some((candidate) => candidate.id === shipId) &&
        state.getPlayerState(playerId).cash >= buildCost(state, playerId, shipId, systemId) &&
        buildLocations(state, playerId, shipId).includes(systemId)
    )
}

export function canBuildAnyShip(state: HydratedStellarHorizonsGameState, playerId: string) {
    const cash = state.getPlayerState(playerId).cash
    return shipsAvailableToBuild(state, playerId).some(
        (definition) => shipCost(state, playerId, definition.id) <= cash
    )
}

export function dockRepairCapacity(
    state: HydratedStellarHorizonsGameState,
    ship: ShipState
): number {
    if (!hasArrived(ship)) {
        return 0
    }
    const cash = state.getPlayerState(ship.playerId).cash
    if (ship.systemId === SOL_SYSTEM_ID) {
        return Math.min(ship.damage, Math.floor(cash / DOCK_REPAIR_COST))
    }
    const base = state.base(ship.playerId, ship.systemId)
    if (!base) {
        return 0
    }
    return Math.min(ship.damage, Math.floor(cash / DOCK_REPAIR_COST), base.settlements - base.spent)
}

export function remoteFullRepairCost(shipId: string): number {
    return roundHalfUp(shipDefinition(shipId).cost / 2)
}

export function repairCost(shipId: string, method: RepairMethod, points: number): number {
    switch (method) {
        case RepairMethod.Dock:
            return points * DOCK_REPAIR_COST
        case RepairMethod.RemotePoint:
            return REMOTE_REPAIR_POINT_COST
        case RepairMethod.RemoteFull:
            return remoteFullRepairCost(shipId)
    }
}

export function canRepair(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    shipId: string,
    method: RepairMethod,
    points: number
): boolean {
    const ship = state.playerShip(playerId, shipId)
    if (!ship || ship.damage === 0 || !hasArrived(ship)) {
        return false
    }
    const player = state.getPlayerState(playerId)
    switch (method) {
        case RepairMethod.Dock:
            return (
                Number.isInteger(points) && points >= 1 && points <= dockRepairCapacity(state, ship)
            )
        case RepairMethod.RemotePoint:
            return !player.remoteRepairUsed && player.cash >= REMOTE_REPAIR_POINT_COST
        case RepairMethod.RemoteFull:
            return !player.remoteRepairUsed && player.cash >= remoteFullRepairCost(shipId)
    }
}

export function canRepairAnyShip(state: HydratedStellarHorizonsGameState, playerId: string) {
    return state
        .shipsOf(playerId)
        .some((ship) =>
            Object.values(RepairMethod).some((method) =>
                canRepair(state, playerId, ship.shipId, method, 1)
            )
        )
}

// Self Repair System takes a point of damage off each of the Player's CVs, free, as their build
// and repair phase begins.
export function selfRepair(state: HydratedStellarHorizonsGameState, playerId: string): string[] {
    const points = capabilitiesOf(state, playerId).selfRepair
    if (points === 0) {
        return []
    }
    return state
        .shipsOf(playerId)
        .filter((ship) => isCrewVehicle(shipDefinition(ship.shipId)) && ship.damage > 0)
        .map((ship) => {
            ship.damage = Math.max(0, ship.damage - points)
            return ship.shipId
        })
}

export function scrapRefund(ship: ShipState): number {
    if (ship.systemId !== SOL_SYSTEM_ID || !hasArrived(ship) || ship.damage > 0) {
        return 0
    }
    return roundHalfUp(shipDefinition(ship.shipId).cost / 2)
}

export function cloningBases(state: HydratedStellarHorizonsGameState, playerId: string): string[] {
    if (!capabilitiesOf(state, playerId).cloning) {
        return []
    }
    if (state.getPlayerState(playerId).cash < cloningCost(state, playerId)) {
        return []
    }
    return state
        .basesOf(playerId)
        .filter((base) => !base.cloned && !blocksBases(state, base.systemId))
        .map((base) => base.systemId)
}
