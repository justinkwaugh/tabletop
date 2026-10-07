import { assertExists } from '@tabletop/common'
import { sameStopCounts, type TileFace, type TrackRules } from '@tabletop/18xx'
import { EighteenThirtyTwoMap } from './map.js'
import { EighteenThirtyTwoTileSet } from './tiles.js'
import { EighteenThirtyTwoPhases } from './trains.js'

const Tampa = 'Z25'

// Atlanta's green tile joins its three cities into one brown city (§6.4.4).
function atlantaJoinsCities(before: TileFace, after: TileFace): boolean {
    return before.labels.includes('A') && after.labels.includes('A') && after.color === 'brown'
}

export const EighteenThirtyTwoTrackRules: TrackRules = {
    map: EighteenThirtyTwoMap,
    tileSet: EighteenThirtyTwoTileSet,
    colorOrder: ['white', 'yellow', 'green', 'brown'],
    availableColors: (state) => EighteenThirtyTwoPhases.phase(state.phaseId).tileColors,
    // A company lays two yellow tiles or upgrades one tile (§6).
    allowance(state, color) {
        const lays = state.trackStep?.lays ?? []
        if (!lays.length) return { cost: 0 }
        if (lays.length === 1 && lays[0].color === 'yellow' && color === 'yellow')
            return { cost: 0 }
        return { reason: 'A company lays two yellow tiles or upgrades one tile.' }
    },
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
    restriction(state, request) {
        const definition = EighteenThirtyTwoTileSet.definitions.find(
            (tile) => tile.id === request.definitionId
        )
        assertExists(definition, 'A track request names a tile of the set')
        if (request.locationId === Tampa && definition.face.color === 'brown')
            return 'Tampa has no brown upgrade'
        return undefined
    }
}
