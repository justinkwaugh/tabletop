import { assertExists } from '@tabletop/common'
import {
    RailwayMapState,
    sameStopCounts,
    type ConstructionState,
    type MapStateData,
    type TileFace,
    type TrackRules
} from '@tabletop/18xx'
import { EighteenThirtyTwoMap, MediumCityLocationIds } from './map.js'
import { EighteenThirtyTwoTileSet } from './tiles.js'
import { EighteenThirtyTwoPhases } from './trains.js'
import { migrateRevenueTokens } from './revenueTokens.js'
import { requireTitleState } from './titleState.js'

const Tampa = 'Z25'

// Atlanta's green tile joins its three cities into one brown city (§6.4.4).
function atlantaJoinsCities(before: TileFace, after: TileFace): boolean {
    return before.labels.includes('A') && after.labels.includes('A') && after.color === 'brown'
}

const stopCount = (face: TileFace, kind: 'city' | 'town') =>
    face.nodes.filter((node) => node.kind === kind).length

function currentFace(state: MapStateData, locationId: string): TileFace {
    return new RailwayMapState(
        EighteenThirtyTwoMap,
        EighteenThirtyTwoTileSet,
        state.tileInventory
    ).tile(locationId).face
}

/**
 * From phase 3 a medium city's yellow town tile may become a yellow city tile, the upgrade of
 * that turn (§4.2.1, §6.4.2).
 */
function promotesMediumCity(state: ConstructionState, locationId: string, after: TileFace) {
    if (!MediumCityLocationIds.includes(locationId)) return false
    const before = currentFace(state, locationId)
    return (
        EighteenThirtyTwoPhases.isAtLeast(state.phaseId, '3') &&
        before.color === 'yellow' &&
        stopCount(before, 'town') === 1 &&
        stopCount(before, 'city') === 0 &&
        after.color === 'yellow' &&
        stopCount(after, 'city') === 1 &&
        stopCount(after, 'town') === 0
    )
}

// A lay replaced an existing tile when it is not yellow, or it promoted a medium city.
function laidUpgrade(state: ConstructionState, lay: { locationId: string; color: string }) {
    return (
        lay.color !== 'yellow' ||
        (MediumCityLocationIds.includes(lay.locationId) &&
            stopCount(currentFace(state, lay.locationId), 'city') > 0)
    )
}

/** Medium cities not yet promoted: untiled, or still with their yellow town tile (§6.4.2). */
export function unpromotedMediumCities(state: MapStateData): string[] {
    return MediumCityLocationIds.filter((locationId) => {
        const face = currentFace(state, locationId)
        return face.color === 'white' || (face.color === 'yellow' && !stopCount(face, 'city'))
    })
}

export const EighteenThirtyTwoTrackRules: TrackRules = {
    map: EighteenThirtyTwoMap,
    tileSet: EighteenThirtyTwoTileSet,
    colorOrder: ['white', 'yellow', 'green', 'brown'],
    availableColors: (state) => EighteenThirtyTwoPhases.phase(state.phaseId).tileColors,
    // A company lays two yellow tiles or upgrades one tile (§6).
    allowance(state, color, upgrade) {
        const lays = state.trackStep?.lays ?? []
        if (!lays.length) return { cost: 0 }
        const newYellow = color === 'yellow' && !upgrade
        if (newYellow && lays.length === 1 && !lays.some((lay) => laidUpgrade(state, lay)))
            return { cost: 0 }
        return { reason: 'A company lays two yellow tiles or upgrades one tile.' }
    },
    upgradesWithinColor: promotesMediumCity,
    preservesStops: (before, after) =>
        sameStopCounts(before, after) || atlantaJoinsCities(before, after),
    // New track must be usable, or the new tile's city or town on the company's route (§6.1–6.2).
    useful: ({ home, newTrack, connectedCity, connectedTown }) =>
        home || newTrack || connectedCity || connectedTown,
    homeLocations: (companyId) => EighteenThirtyTwoMap.reservedLocationIds(companyId),
    // A company lays its first tile in its own home hex without the terrain cost (§6.5.1).
    terrainCost: (_state, request, cost) =>
        EighteenThirtyTwoMap.reservedLocationIds(request.companyId).includes(request.locationId)
            ? 0
            : cost,
    afterLay(state, details) {
        migrateRevenueTokens(requireTitleState(state), details.locationId, details.nodeMapping)
        return { payments: [], closedPrivateIds: [] }
    },
    restriction(_state, request) {
        const definition = EighteenThirtyTwoTileSet.definitions.find(
            (tile) => tile.id === request.definitionId
        )
        assertExists(definition, 'A track request names a tile of the set')
        if (request.locationId === Tampa && definition.face.color === 'brown')
            return 'Tampa has no brown upgrade'
        return undefined
    }
}
