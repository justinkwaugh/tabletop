import { STAR_MAP } from './starMap.js'
import { SYSTEMS } from './systemCatalog.js'
import { Sector, type StarSystemDefinition, type SystemDefinition } from './systemTypes.js'

export * from './systemTypes.js'

export function systemDefinition(systemId: string): SystemDefinition {
    const system = SYSTEMS.find((candidate) => candidate.id === systemId)
    if (!system) {
        throw new Error(`Unknown system ${systemId}`)
    }
    return system
}

export function starSystemDefinition(systemId: string): StarSystemDefinition {
    const system = systemDefinition(systemId)
    if (!('habitability' in system)) {
        throw new Error(`${system.name} is not an explorable star system`)
    }
    return system
}

export function systemsInSectors(sectors: readonly Sector[]): SystemDefinition[] {
    return SYSTEMS.filter((system) => sectors.includes(system.sector))
}

export function systemDistance(fromSystemId: string, toSystemId: string): number {
    return STAR_MAP.distance(fromSystemId, toSystemId)
}
