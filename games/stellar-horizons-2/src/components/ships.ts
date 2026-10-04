import { Faction } from './factions.js'
import { SHIPS, ShipKind, type ShipDefinition } from './shipCatalog.js'

export { ShipKind, type ShipDefinition } from './shipCatalog.js'

export function shipDefinition(shipId: string): ShipDefinition {
    const ship = SHIPS.find((candidate) => candidate.id === shipId)
    if (!ship) {
        throw new Error(`Unknown ship ${shipId}`)
    }
    return ship
}

export function factionShips(faction: Faction): ShipDefinition[] {
    return SHIPS.filter((ship) => ship.faction === faction)
}

export function isCrewVehicle(ship: ShipDefinition): boolean {
    return ship.kind === ShipKind.CV
}
