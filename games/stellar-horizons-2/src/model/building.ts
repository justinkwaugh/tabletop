import { SOL_SYSTEM_ID } from '../components/systems.js'
import { ShipKind, factionShips, shipDefinition, type ShipDefinition } from '../components/ships.js'
import { capabilitiesOf, hasArrived } from './fleet.js'
import type { HydratedStellarHorizonsGameState } from './gameState.js'
import type { ShipState } from './pieces.js'
import { roundHalfUp } from './turn.js'

export const DOCK_REPAIR_COST = 1
export const REMOTE_REPAIR_POINT_COST = 3
export const CLONING_COST = 5

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
    if (!faction) {
        return []
    }
    const maxSize = capabilitiesOf(state, playerId).cvMaxSize
    return factionShips(faction).filter(
        (definition) =>
            !state.findShip(definition.id) &&
            (definition.kind === ShipKind.RE || definition.size <= maxSize)
    )
}

export function buildLocations(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    shipId: string
): string[] {
    const cost = shipDefinition(shipId).cost
    const bases = state
        .basesOf(playerId)
        .filter((base) => base.settlements >= cost && base.spent + cost <= base.settlements)
        .map((base) => base.systemId)
    return [SOL_SYSTEM_ID, ...bases]
}

export function canBuildShip(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    shipId: string,
    systemId: string
): boolean {
    const definition = shipDefinition(shipId)
    return (
        shipsAvailableToBuild(state, playerId).some((candidate) => candidate.id === shipId) &&
        state.getPlayerState(playerId).cash >= definition.cost &&
        buildLocations(state, playerId, shipId).includes(systemId)
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
    if (state.getPlayerState(playerId).cash < CLONING_COST) {
        return []
    }
    return state
        .basesOf(playerId)
        .filter((base) => !base.cloned)
        .map((base) => base.systemId)
}
