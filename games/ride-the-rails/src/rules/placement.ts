import { assertExists } from '@tabletop/common'
import type { HexId } from '../data/hexes.js'
import { placementLimit } from '../data/placementLimits.js'
import { RAILROAD_IDS, type RailroadId } from '../data/railroads.js'
import {
    adjacentHexIds,
    USA_CITIES,
    USA_HEXES,
    usaCity,
    usaHex,
    type CityCapacity
} from '../data/usaMap.js'
import type { BuildingTurn, HydratedRideTheRailsGameState, Track } from '../model/gameState.js'
import { hasSupply } from './supply.js'
import { isEastCoastCity, mayStartIn } from './startRailroad.js'
import { hasTrackIn, railroadsIn } from './track.js'

const EAST_COAST_CITIES_PER_RAILROAD = 2

const NON_CITY_CAPACITY = 2

// The placement test's clauses in order; the first that fails is the reason.
export type PlacementRefusal =
    | 'no-share'
    | 'empty-supply'
    | 'over-placement-limit'
    | 'railroad-in-hex'
    | 'hex-at-capacity'
    | 'east-coast-cities-held'
    | 'not-adjacent-or-start'

export type PlacementVerdict =
    { legal: true; isStart: boolean } | { legal: false; reason: PlacementRefusal }

export type LegalPlacement = {
    railroadId: RailroadId
    hexId: HexId
    isStart: boolean
}

// R-3.2.3, R-3.2.4: one less once this turn has a mountain placement, this one included.
export function withinPlacementLimit(state: HydratedRideTheRailsGameState, hexId: HexId): boolean {
    const building = currentBuildingTurn(state)
    const usesMountain = building.usedMountain || usaHex(hexId).terrain === 'mountain'
    return building.placed + 1 <= placementLimit(state.mapId, state.players.length, usesMountain)
}

// R-3.2.3, R-3.2.4: what the limit leaves this turn, before any further mountain placement.
export function placementsLeft(state: HydratedRideTheRailsGameState): number {
    const building = currentBuildingTurn(state)
    const limit = placementLimit(state.mapId, state.players.length, building.usedMountain)
    return limit - building.placed
}

// R-4.1.4: 2 locomotives, 1 in an East Coast city, no limit in Chicago.
export function hexCapacity(hexId: HexId): CityCapacity {
    const hex = usaHex(hexId)
    return hex.terrain === 'city' ? usaCity(hex.cityId).capacity : NON_CITY_CAPACITY
}

export function hasRoomIn(track: Track, hexId: HexId): boolean {
    const capacity = hexCapacity(hexId)
    return capacity === 'unlimited' || railroadsIn(track, hexId).length < capacity
}

// R-4.1.4, R-4.2.5-H1: the East Coast cities holding this railroad's track, a start included.
export function eastCoastCitiesHeld(track: Track, railroadId: RailroadId): number {
    return USA_CITIES.filter(
        (city) => isEastCoastCity(city) && hasTrackIn(track, city.hexId, railroadId)
    ).length
}

// R-4.1.2
export function isAdjacentToOwnTrack(track: Track, railroadId: RailroadId, hexId: HexId): boolean {
    return adjacentHexIds(hexId).some((adjacent) => hasTrackIn(track, adjacent, railroadId))
}

// The placement test: R-3.2.2, R-1.1-H1, R-3.2.3, R-3.2.4, R-4.1.3, R-4.1.4, R-4.1.1, R-4.1.2,
// R-4.2. A placement adjacent to the railroad's own track is never a start (R-4.1.2, R-4.2.3-H1).
export function placementTest(
    state: HydratedRideTheRailsGameState,
    playerId: string,
    railroadId: RailroadId,
    hexId: HexId
): PlacementVerdict {
    const refusal = firstRefusal(state, playerId, railroadId, hexId)
    if (refusal) {
        return { legal: false, reason: refusal }
    }
    if (isAdjacentToOwnTrack(state.track, railroadId, hexId)) {
        return { legal: true, isStart: false }
    }
    if (mayStartIn(state, railroadId, hexId)) {
        return { legal: true, isStart: true }
    }
    return { legal: false, reason: 'not-adjacent-or-start' }
}

// Every placement that passes the placement test, by railroad in R-1.4 order, then by hex in
// map order (row, then dcol).
export function legalPlacements(
    state: HydratedRideTheRailsGameState,
    playerId: string
): LegalPlacement[] {
    return RAILROAD_IDS.flatMap((railroadId) =>
        USA_HEXES.flatMap((hex): LegalPlacement[] => {
            const verdict = placementTest(state, playerId, railroadId, hex.id)
            return verdict.legal ? [{ railroadId, hexId: hex.id, isStart: verdict.isStart }] : []
        })
    )
}

function firstRefusal(
    state: HydratedRideTheRailsGameState,
    playerId: string,
    railroadId: RailroadId,
    hexId: HexId
): PlacementRefusal | undefined {
    if (state.getPlayerState(playerId).sharesOf(railroadId) < 1) {
        return 'no-share'
    }
    if (!hasSupply(state, railroadId)) {
        return 'empty-supply'
    }
    if (!withinPlacementLimit(state, hexId)) {
        return 'over-placement-limit'
    }
    if (hasTrackIn(state.track, hexId, railroadId)) {
        return 'railroad-in-hex'
    }
    if (!hasRoomIn(state.track, hexId)) {
        return 'hex-at-capacity'
    }
    if (
        isEastCoastHex(hexId) &&
        eastCoastCitiesHeld(state.track, railroadId) >= EAST_COAST_CITIES_PER_RAILROAD
    ) {
        return 'east-coast-cities-held'
    }
    return undefined
}

export function isEastCoastHex(hexId: HexId): boolean {
    const hex = usaHex(hexId)
    return hex.terrain === 'city' && isEastCoastCity(usaCity(hex.cityId))
}

function currentBuildingTurn(state: HydratedRideTheRailsGameState): BuildingTurn {
    assertExists(state.building, 'The placement limit applies only in a building turn')
    return state.building
}
