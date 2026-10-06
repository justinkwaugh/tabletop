import { placeBlockingStations } from './stations.js'
import { assertExists } from '@tabletop/common'
import {
    RailwayMapState,
    privateOwner,
    type ConstructionState,
    rotateTileEdge,
    rotateTileFace,
    sameStopCounts,
    type TrackRules
} from '@tabletop/18xx'
import { EighteenFortySixMap, LandGrantLocations, PrivateTrackBlocks } from './map.js'
import { EighteenFortySixTileSet } from './tiles.js'
import { Phases1846 } from './trains.js'

function ownsTunnelBlasting(state: ConstructionState, companyId: string): boolean {
    if (!state.companies.some((company) => company.id === 'TBC' && !company.closed)) return false
    const owner = privateOwner(state, 'TBC')
    return owner?.kind === 'company' && owner.companyId === companyId
}

export const TrackRules1846: TrackRules = {
    map: EighteenFortySixMap,
    tileSet: EighteenFortySixTileSet,
    colorOrder: ['white', 'yellow', 'green', 'brown', 'gray'],
    availableColors: (state) => Phases1846.phase(state.phaseId).tileColors,
    allowance(state, color) {
        const lays = state.trackStep?.lays ?? []
        if (lays.length >= 2) return { reason: 'Two construction actions are allowed per turn.' }
        if (color !== 'yellow' && lays.some((lay) => lay.color !== 'yellow'))
            return { reason: 'Only one ordinary upgrade is allowed per turn.' }
        return { cost: 0 }
    },
    preservesStops: sameStopCounts,
    useful: ({ newTrack, connectedCity }) => newTrack || connectedCity,
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
        const borders = [
            ...(EighteenFortySixMap.location(request.locationId).borders ?? []).filter(
                (border) => border.edge === edge
            ),
            ...(neighbor.borders ?? []).filter((border) => border.edge === opposite)
        ]
        const chargedCost =
            ownsTunnelBlasting(state, request.companyId) &&
            borders.some((border) => border.kind === 'mountain')
                ? Math.max(0, cost - 20)
                : cost
        return rotateTileFace(tile.face, tile.rotation).paths.some((path) =>
            path.endpoints.some((end) => end.kind === 'edge' && end.edge === opposite)
        )
            ? chargedCost
            : 0
    },
    afterLay(state, details) {
        if (
            new RailwayMapState(
                EighteenFortySixMap,
                EighteenFortySixTileSet,
                state.tileInventory
            ).tile(details.locationId).face.color === 'green'
        )
            placeBlockingStations(state, details.locationId)
        return { payments: [], closedPrivateIds: [] }
    },
    terrainCost(state, request, cost) {
        const previous = new RailwayMapState(
            EighteenFortySixMap,
            EighteenFortySixTileSet,
            state.tileInventory
        ).tile(request.locationId)
        if (
            previous.face.color === 'white' &&
            request.companyId === 'IC' &&
            LandGrantLocations.includes(request.locationId)
        )
            return cost
        const terrain = previous.placement
            ? 0
            : (EighteenFortySixMap.location(request.locationId).terrain?.cost ?? 0)
        const mountainDiscount =
            !previous.placement &&
            ownsTunnelBlasting(state, request.companyId) &&
            EighteenFortySixMap.location(request.locationId).terrain?.kinds.includes('mountain')
                ? Math.min(20, terrain)
                : 0
        return cost + Math.max(0, 20 - terrain) - mountainDiscount
    }
}
