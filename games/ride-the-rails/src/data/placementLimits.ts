import { assertExists } from '@tabletop/common'
import type { Hex, HexGroup } from './boardMap.js'
import { hexById } from './boardMaps.js'
import type { HexId } from './hexes.js'
import type { MapId } from './maps.js'
import type { RailroadId } from './railroads.js'

export type PlacementLimitRow = {
    readonly playerCount: number
    readonly limit: number
}

export type MapPlacementLimits = {
    readonly byPlayerCount: readonly PlacementLimitRow[]
    readonly mountainReduction: number
    // R-8: the railroads whose mountain placements leave the limit as it is; none unless named.
    readonly mountainExempt?: readonly RailroadId[]
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
    },
    // R-8.2: a mountain placement costs two.
    'map.au': {
        byPlayerCount: [
            { playerCount: 3, limit: 8 },
            { playerCount: 4, limit: 5 },
            { playerCount: 5, limit: 4 }
        ],
        mountainReduction: 2
    },
    // R-8.3: no mountains, so nothing lowers the limit.
    'map.ca': {
        byPlayerCount: [
            { playerCount: 3, limit: 7 },
            { playerCount: 4, limit: 5 },
            { playerCount: 5, limit: 4 }
        ],
        mountainReduction: 0
    },
    // R-8.4: the board's reminder strip.
    'map.fr': {
        byPlayerCount: [
            { playerCount: 3, limit: 8 },
            { playerCount: 4, limit: 5 },
            { playerCount: 5, limit: 4 }
        ],
        mountainReduction: 1
    },
    // R-8.5: the board's reminder strip; Orange's mountain placements leave the limit as it is.
    'map.de': {
        byPlayerCount: [
            { playerCount: 3, limit: 8 },
            { playerCount: 4, limit: 5 },
            { playerCount: 5, limit: 4 }
        ],
        mountainReduction: 1,
        mountainExempt: ['railroad.orange']
    }
}

// R-3.2.3, R-3.2.4: the reduction applies once, however many mountain placements the turn holds.
export function placementLimit(mapId: MapId, playerCount: number, usedMountain: boolean): number {
    const limits = PLACEMENT_LIMITS[mapId]
    const row = limits.byPlayerCount.find((candidate) => candidate.playerCount === playerCount)
    assertExists(row, `No placement limit on ${mapId} for ${playerCount} players`)
    return usedMountain ? row.limit - limits.mountainReduction : row.limit
}

// R-3.2.4, R-8: a mountain placement charges the map's mountain cost, unless the railroad is exempt.
export function chargesMountain(
    limits: MapPlacementLimits,
    railroadId: RailroadId,
    hex: Hex
): boolean {
    return hex.terrain === 'mountain' && !(limits.mountainExempt ?? []).includes(railroadId)
}

// R-3.2.4, R-8: whether this placement lowers the turn's placement limit.
export function lowersLimit(mapId: MapId, railroadId: RailroadId, hexId: HexId): boolean {
    return chargesMountain(PLACEMENT_LIMITS[mapId], railroadId, hexById(hexId))
}

export type GroupLimit = {
    readonly group: HexGroup
    readonly perRailroad: number
}

// R-4.1.4, R-4.2.5: a railroad holds at most two East Coast cities, a start counted; R-8: an
// expansion map adds its own row (R-8.4: two Red/Blue/Black cities, one Paris entry hex).
export const GROUP_LIMITS: Readonly<Record<MapId, readonly GroupLimit[]>> = {
    'map.usa': [{ group: 'east-coast', perRailroad: 2 }],
    'map.au': [],
    'map.ca': [],
    'map.fr': [
        { group: 'red-blue-black', perRailroad: 2 },
        { group: 'paris-entry', perRailroad: 1 }
    ],
    // R-8.5: the board prints no x1 and no group limit.
    'map.de': []
}
