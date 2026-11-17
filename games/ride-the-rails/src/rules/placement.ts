import { assertExists } from '@tabletop/common'
import type { CityId, HexGroup } from '../data/boardMap.js'
import {
    adjacentHexIds,
    boardMap,
    groupsOf,
    hexCapacity,
    isHexId,
    isLongDistance
} from '../data/boardMaps.js'
import type { HexId } from '../data/hexes.js'
import type { MapId } from '../data/maps.js'
import { GROUP_LIMITS, lowersLimit, placementLimit } from '../data/placementLimits.js'
import { RAILROAD_IDS, type RailroadId } from '../data/railroads.js'
import type { BuildingTurn, HydratedRideTheRailsGameState, Track } from '../model/gameState.js'
import { hasSupply } from './supply.js'
import { mayStartIn } from './startRailroad.js'
import { hasTrackIn, railroadsIn } from './track.js'

// The placement test's clauses in order; the first that fails is the reason.
export type PlacementRefusal =
    | 'no-share'
    | 'empty-supply'
    | 'over-placement-limit'
    | 'long-distance-ended-turn'
    | 'long-distance-not-first'
    | 'railroad-in-hex'
    | 'hex-at-capacity'
    | 'group-limit-reached'
    | 'not-adjacent-or-start'

export type PlacementVerdict =
    { legal: true; isStart: boolean } | { legal: false; reason: PlacementRefusal }

export type LegalPlacement = {
    railroadId: RailroadId
    hexId: HexId
    isStart: boolean
}

// R-3.2.3, R-3.2.4: one less once this turn has a placement that lowers the limit, this one
// included; R-8: a map may exempt a railroad from its mountain cost.
export function withinPlacementLimit(
    state: HydratedRideTheRailsGameState,
    railroadId: RailroadId,
    hexId: HexId
): boolean {
    const building = currentBuildingTurn(state)
    const lowered = building.usedMountain || lowersLimit(state.mapId, railroadId, hexId)
    return building.placed + 1 <= placementLimit(state.mapId, state.players.length, lowered)
}

// R-3.2.3, R-3.2.4: what the limit leaves this turn, before any further mountain placement.
export function placementsLeft(state: HydratedRideTheRailsGameState): number {
    const building = currentBuildingTurn(state)
    const limit = placementLimit(state.mapId, state.players.length, building.usedMountain)
    return limit - building.placed
}

// R-8.2: a long-distance hex, Perth or Brisbane takes the turn's first placement only, and that
// placement ends the turn.
export function longDistanceRefusal(
    building: BuildingTurn,
    longDistance: boolean
): PlacementRefusal | undefined {
    if (building.usedLongDistance) {
        return 'long-distance-ended-turn'
    }
    if (longDistance && building.placed > 0) {
        return 'long-distance-not-first'
    }
    return undefined
}

export function hasRoomIn(track: Track, hexId: HexId): boolean {
    const capacity = hexCapacity(hexId)
    return capacity === 'unlimited' || railroadsIn(track, hexId).length < capacity
}

// R-4.1.4, R-4.2.5, R-8: the hexes of a group holding this railroad's track, a start included.
export function groupHexesHeld(track: Track, railroadId: RailroadId, group: HexGroup): number {
    return Object.entries(track).filter(
        ([hexId, railroadIds]) =>
            isHexId(hexId) && railroadIds.includes(railroadId) && groupsOf(hexId).includes(group)
    ).length
}

// The hexes of each group the railroad holds, counted once a clause asks.
type GroupHoldings = (group: HexGroup) => number

function groupHoldings(track: Track, railroadId: RailroadId): GroupHoldings {
    const counted = new Map<HexGroup, number>()
    return (group) => {
        const held = counted.get(group) ?? groupHexesHeld(track, railroadId, group)
        counted.set(group, held)
        return held
    }
}

// R-4.1.2
export function isAdjacentToOwnTrack(track: Track, railroadId: RailroadId, hexId: HexId): boolean {
    return adjacentHexIds(hexId).some((adjacent) => hasTrackIn(track, adjacent, railroadId))
}

// The placement test: R-3.2.2, R-1.1, R-3.2.3, R-3.2.4, R-8, R-4.1.3, R-4.1.4, R-4.1.1, R-4.1.2,
// R-4.2. A placement adjacent to the railroad's own track is never a start (R-4.1.2, R-4.2.3).
export function placementTest(
    state: HydratedRideTheRailsGameState,
    playerId: string,
    railroadId: RailroadId,
    hexId: HexId
): PlacementVerdict {
    const refusal =
        railroadRefusal(state, playerId, railroadId) ??
        hexRefusal(state, railroadId, hexId, groupHoldings(state.track, railroadId))
    return refusal ? { legal: false, reason: refusal } : startOrAdjacency(state, railroadId, hexId)
}

// Every placement that passes the placement test, by railroad in R-1.4 order, then by hex in
// the map's reading order.
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
// group hexes it holds) checked once per railroad.
function* placementsPassing(
    state: HydratedRideTheRailsGameState,
    playerId: string
): Generator<LegalPlacement> {
    for (const railroadId of RAILROAD_IDS) {
        if (railroadRefusal(state, playerId, railroadId)) {
            continue
        }
        const held = groupHoldings(state.track, railroadId)
        for (const hex of boardMap(state.mapId).hexes) {
            if (hexRefusal(state, railroadId, hex.id, held)) {
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

// R-3.2.3, R-3.2.4, R-8, R-4.1.3, R-4.1.4: the clauses about this hex, in order.
function hexRefusal(
    state: HydratedRideTheRailsGameState,
    railroadId: RailroadId,
    hexId: HexId,
    held: GroupHoldings
): PlacementRefusal | undefined {
    if (!withinPlacementLimit(state, railroadId, hexId)) {
        return 'over-placement-limit'
    }
    return (
        longDistanceRefusal(currentBuildingTurn(state), isLongDistance(hexId)) ??
        roomRefusal(state.mapId, state.track, railroadId, hexId, held)
    )
}

// R-4.1.3, R-4.1.4, R-8: the clauses about the track already in the hex, in order.
function roomRefusal(
    mapId: MapId,
    track: Track,
    railroadId: RailroadId,
    hexId: HexId,
    held: GroupHoldings
): PlacementRefusal | undefined {
    if (hasTrackIn(track, hexId, railroadId)) {
        return 'railroad-in-hex'
    }
    if (!hasRoomIn(track, hexId)) {
        return 'hex-at-capacity'
    }
    const groups = groupsOf(hexId)
    const full = GROUP_LIMITS[mapId].some(
        ({ group, perRailroad }) => groups.includes(group) && held(group) >= perRailroad
    )
    return full ? 'group-limit-reached' : undefined
}

// R-4.2: the cities where the railroad could start now, in the map table's order: those with room
// for it (R-4.1.3, R-4.1.4) where the placement test would make a placement its start (R-4.1.2,
// R-4.2). The clauses about the seat and the turn (a share, the supply, the placement limit) are
// left out, so the set is the same for every seat at any point of the round.
export function startCityIds(
    state: HydratedRideTheRailsGameState,
    railroadId: RailroadId
): CityId[] {
    const held = groupHoldings(state.track, railroadId)
    return boardMap(state.mapId)
        .cities.filter((city) => {
            if (roomRefusal(state.mapId, state.track, railroadId, city.hexId, held)) {
                return false
            }
            const verdict = startOrAdjacency(state, railroadId, city.hexId)
            return verdict.legal && verdict.isStart
        })
        .map((city) => city.id)
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
    return groupsOf(hexId).includes('east-coast')
}

function currentBuildingTurn(state: HydratedRideTheRailsGameState): BuildingTurn {
    assertExists(state.building, 'The placement limit applies only in a building turn')
    return state.building
}
