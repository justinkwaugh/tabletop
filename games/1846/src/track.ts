import { assertExists } from '@tabletop/common'
import {
    RailwayMapState,
    privateOwner,
    rotateTileEdge,
    rotateTileFace,
    sameStopCounts,
    type TrackRules
} from '@tabletop/18xx'
import { EighteenFortySixMap, LandGrantLocations, PrivateTrackBlocks } from './map.js'
import { EighteenFortySixTileSet } from './tiles.js'

export const TrackRules1846: TrackRules = {
    map: EighteenFortySixMap,
    tileSet: EighteenFortySixTileSet,
    colorOrder: ['white', 'yellow', 'green', 'brown', 'gray'],
    availableColors: () => ['yellow'],
    allowance: (state) =>
        (state.trackStep?.lays.length ?? 0) < 2
            ? { cost: 0 }
            : { reason: 'Two tile lays are allowed per operating round.' },
    preservesStops: sameStopCounts,
    useful: ({ newTrack }) => newTrack,
    homeLocations: (id) => EighteenFortySixMap.reservedLocationIds(id),
    restriction(state, request) {
        for (const [privateId, locations] of Object.entries(PrivateTrackBlocks))
            if (
                locations.includes(request.locationId) &&
                state.companies.some((company) => company.id === privateId) &&
                privateOwner(state, privateId)?.kind === 'player'
            )
                return 'This hex is reserved by a player-owned private company.'
        return undefined
    },
    borderCost(state, request, edge, cost) {
        if (!cost) return 0
        const neighbor = EighteenFortySixMap.neighbor(request.locationId, edge)
        assertExists(neighbor, 'Construction validates neighboring hexes before pricing borders')
        const tile = new RailwayMapState(
            EighteenFortySixMap,
            EighteenFortySixTileSet,
            state.tileInventory
        ).tile(neighbor.id)
        const opposite = rotateTileEdge(edge, 3)
        return rotateTileFace(tile.face, tile.rotation).paths.some((path) =>
            path.endpoints.some((end) => end.kind === 'edge' && end.edge === opposite)
        )
            ? cost
            : 0
    },
    terrainCost(_state, request, cost) {
        if (request.companyId === 'IC' && LandGrantLocations.includes(request.locationId))
            return cost
        const terrain = EighteenFortySixMap.location(request.locationId).terrain?.cost ?? 0
        return cost + Math.max(0, 20 - terrain)
    }
}
