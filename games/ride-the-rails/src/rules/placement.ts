import { assertExists } from '@tabletop/common'
import type { HexId } from '../data/hexes.js'
import { placementLimit } from '../data/placementLimits.js'
import { RAILROAD_IDS, type RailroadId } from '../data/railroads.js'
import {
    adjacentHexIds,
    cityIn,
    type CityId,
    USA_CITIES,
    USA_HEXES,
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
    return cityIn(hexId)?.capacity ?? NON_CITY_CAPACITY
}

export function hasRoomIn(track: Track, hexId: HexId): boolean {
    const capacity = hexCapacity(hexId)
    return capacity === 'unlimited' || railroadsIn(track, hexId).length < capacity
}

// R-4.1.4, R-4.2.5: the East Coast cities holding this railroad's track, a start included.
export function eastCoastCitiesHeld(track: Track, railroadId: RailroadId): number {
    return USA_CITIES.filter(
        (city) => isEastCoastCity(city) && hasTrackIn(track, city.hexId, railroadId)
    ).length
}

// R-4.1.2
export function isAdjacentToOwnTrack(track: Track, railroadId: RailroadId, hexId: HexId): boolean {
    return adjacentHexIds(hexId).some((adjacent) => hasTrackIn(track, adjacent, railroadId))
}

// The placement test: R-3.2.2, R-1.1, R-3.2.3, R-3.2.4, R-4.1.3, R-4.1.4, R-4.1.1, R-4.1.2,
// R-4.2. A placement adjacent to the railroad's own track is never a start (R-4.1.2, R-4.2.3).
export function placementTest(
    state: HydratedRideTheRailsGameState,
    playerId: string,
    railroadId: RailroadId,
    hexId: HexId
): PlacementVerdict {
    const refusal =
        railroadRefusal(state, playerId, railroadId) ??
        hexRefusal(state, railroadId, hexId, () => eastCoastCitiesHeld(state.track, railroadId))
    return refusal ? { legal: false, reason: refusal } : startOrAdjacency(state, railroadId, hexId)
}

// Every placement that passes the placement test, by railroad in R-1.4 order, then by hex in
// map order (row, then dcol).
export function legalPlacements(
    state: HydratedRideTheRailsGameState,
    playerId: string
): LegalPlacement[] {
    return [...placementsPassing(state, playerId)]
}

// R-3.2.1: whether any placement passes the placement test, without listing them all.
export function hasLegalPlacement(state: HydratedRideTheRailsGameState, playerId: string): boolean {
    return placementsPassing(state, playerId).next().done !== true
}

// The placement test on every hex, the clauses about the railroad alone (share, supply, the
// East Coast cities it holds) checked once per railroad.
function* placementsPassing(
    state: HydratedRideTheRailsGameState,
    playerId: string
): Generator<LegalPlacement> {
    for (const railroadId of RAILROAD_IDS) {
        if (railroadRefusal(state, playerId, railroadId)) {
            continue
        }
        const held = eastCoastCitiesHeld(state.track, railroadId)
        for (const hex of USA_HEXES) {
            if (hexRefusal(state, railroadId, hex.id, () => held)) {
                continue
            }
            const verdict = startOrAdjacency(state, railroadId, hex.id)
            if (verdict.legal) {
                yield { railroadId, hexId: hex.id, isStart: verdict.isStart }
            }
        }
    }
}

// R-3.2.2, R-1.1: the clauses that hold for the railroad on every hex.
function railroadRefusal(
    state: HydratedRideTheRailsGameState,
    playerId: string,
    railroadId: RailroadId
): PlacementRefusal | undefined {
    if (state.getPlayerState(playerId).sharesOf(railroadId) < 1) {
        return 'no-share'
    }
    if (!hasSupply(state, railroadId)) {
        return 'empty-supply'
    }
    return undefined
}

// R-3.2.3, R-3.2.4, R-4.1.3, R-4.1.4: the clauses about this hex, in order.
function hexRefusal(
    state: HydratedRideTheRailsGameState,
    railroadId: RailroadId,
    hexId: HexId,
    eastCoastHeld: () => number
): PlacementRefusal | undefined {
    if (!withinPlacementLimit(state, hexId)) {
        return 'over-placement-limit'
    }
    return roomRefusal(state.track, railroadId, hexId, eastCoastHeld)
}

// R-4.1.3, R-4.1.4: the clauses about the track already in the hex, in order.
function roomRefusal(
    track: Track,
    railroadId: RailroadId,
    hexId: HexId,
    eastCoastHeld: () => number
): PlacementRefusal | undefined {
    if (hasTrackIn(track, hexId, railroadId)) {
        return 'railroad-in-hex'
    }
    if (!hasRoomIn(track, hexId)) {
        return 'hex-at-capacity'
    }
    if (isEastCoastHex(hexId) && eastCoastHeld() >= EAST_COAST_CITIES_PER_RAILROAD) {
        return 'east-coast-cities-held'
    }
    return undefined
}

// R-4.2: the cities where the railroad could start now, in the map table's order: those with room
// for it (R-4.1.3, R-4.1.4) where the placement test would make a placement its start (R-4.1.2,
// R-4.2). The clauses about the seat and the turn (a share, the supply, the placement limit) are
// left out, so the set is the same for every seat at any point of the round.
export function startCityIds(
    state: HydratedRideTheRailsGameState,
    railroadId: RailroadId
): CityId[] {
    const held = eastCoastCitiesHeld(state.track, railroadId)
    return USA_CITIES.filter((city) => {
        if (roomRefusal(state.track, railroadId, city.hexId, () => held)) {
            return false
        }
        const verdict = startOrAdjacency(state, railroadId, city.hexId)
        return verdict.legal && verdict.isStart
    }).map((city) => city.id)
}

// R-4.1.1, R-4.1.2, R-4.2: next to the railroad's own track, or else a start.
function startOrAdjacency(
    state: HydratedRideTheRailsGameState,
    railroadId: RailroadId,
    hexId: HexId
): PlacementVerdict {
    if (isAdjacentToOwnTrack(state.track, railroadId, hexId)) {
        return { legal: true, isStart: false }
    }
    if (mayStartIn(state, railroadId, hexId)) {
        return { legal: true, isStart: true }
    }
    return { legal: false, reason: 'not-adjacent-or-start' }
}

export function isEastCoastHex(hexId: HexId): boolean {
    const city = cityIn(hexId)
    return city !== undefined && isEastCoastCity(city)
}

function currentBuildingTurn(state: HydratedRideTheRailsGameState): BuildingTurn {
    assertExists(state.building, 'The placement limit applies only in a building turn')
    return state.building
}
