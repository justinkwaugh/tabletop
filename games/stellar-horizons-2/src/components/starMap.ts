import {
    HexGrid,
    HexOrientation,
    assertExists,
    coordinatesToNumber,
    distanceAxial,
    type HexGridNode
} from '@tabletop/common'
import { SYSTEMS } from './systemCatalog.js'

export type MapSystem = HexGridNode & { systemId: string }

export class StarMap extends HexGrid<MapSystem> {
    constructor() {
        super({ hexDefinition: { orientation: HexOrientation.Flat } })
        for (const system of SYSTEMS) {
            this.setNode({
                id: coordinatesToNumber(system.coords),
                coords: system.coords,
                systemId: system.id
            })
        }
    }

    system(systemId: string): MapSystem {
        const system = [...this].find((node) => node.systemId === systemId)
        assertExists(system, `No system ${systemId} on the star map`)
        return system
    }

    distance(fromSystemId: string, toSystemId: string): number {
        return distanceAxial(this.system(fromSystemId).coords, this.system(toSystemId).coords)
    }

    adjacentSystemIds(systemId: string): string[] {
        return this.neighborsOf(this.system(systemId)).map((node) => node.systemId)
    }
}

export const STAR_MAP = new StarMap()
