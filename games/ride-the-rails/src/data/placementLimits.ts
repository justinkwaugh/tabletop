import { assertExists } from '@tabletop/common'
import type { MapId } from './maps.js'

export type PlacementLimitRow = {
    readonly playerCount: number
    readonly limit: number
}

export type MapPlacementLimits = {
    readonly byPlayerCount: readonly PlacementLimitRow[]
    readonly mountainReduction: number
}

// R-3.2.3 limits and R-3.2.4 mountain reduction; R-8: an expansion map adds its own row.
export const PLACEMENT_LIMITS: Readonly<Record<MapId, MapPlacementLimits>> = {
    'map.usa': {
        byPlayerCount: [
            { playerCount: 3, limit: 8 },
            { playerCount: 4, limit: 5 },
            { playerCount: 5, limit: 4 }
        ],
        mountainReduction: 1
    }
}

// R-3.2.3, R-3.2.4: the reduction applies once, however many mountain placements the turn holds.
export function placementLimit(mapId: MapId, playerCount: number, usedMountain: boolean): number {
    const limits = PLACEMENT_LIMITS[mapId]
    const row = limits.byPlayerCount.find((candidate) => candidate.playerCount === playerCount)
    assertExists(row, `No placement limit on ${mapId} for ${playerCount} players`)
    return usedMountain ? row.limit - limits.mountainReduction : row.limit
}
