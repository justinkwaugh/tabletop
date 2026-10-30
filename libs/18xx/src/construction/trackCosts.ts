import { assertExists } from '@tabletop/common'
import { RailwayMapState } from '../map/mapState.js'
import { rotateTileEdge, rotateTileFace } from '../tiles/topology.js'
import type { TileEdge } from '../tiles/tile.js'
import {
    laidTileFace,
    type ConstructionState,
    type TrackRequest,
    type TrackRules
} from './trackConstruction.js'

type TrackData = Pick<TrackRules, 'map' | 'tileSet'>

/**
 * One yellow lay, plus either a second yellow lay or one upgrade, in either order: 1846 and
 * its descendants.
 */
export function yellowPlusOneAllowance(rules: TrackData): TrackRules['allowance'] {
    return (state, color) => {
        const lays = state.trackStep?.lays ?? []
        if (lays.length >= 2) return { reason: 'Two construction actions are allowed per turn.' }
        if (
            color !== 'yellow' &&
            lays.some((lay) => laidTileFace(state, rules, lay).color !== 'yellow')
        )
            return { reason: 'Only one ordinary upgrade is allowed per turn.' }
        return { cost: 0 }
    }
}

/**
 * A hexside's cost is paid by the lay that completes a crossing: when the neighbour's track
 * already reaches the hexside.
 */
export function completedCrossingCost(
    { map, tileSet }: TrackData,
    state: ConstructionState,
    request: TrackRequest,
    edge: TileEdge,
    cost: number
): number {
    if (!cost) return 0
    const neighbor = map.neighbor(request.locationId, edge)
    assertExists(neighbor, 'Construction validates neighboring hexes before pricing borders')
    const tile = new RailwayMapState(map, tileSet, state.tileInventory).tile(neighbor.id)
    const opposite = rotateTileEdge(edge, 3)
    return rotateTileFace(tile.face, tile.rotation).paths.some((path) =>
        path.endpoints.some((end) => end.kind === 'edge' && end.edge === opposite)
    )
        ? cost
        : 0
}

/**
 * The printed terrain cost of a hex's first tile, or of replacing its preprinted tile; laid
 * tiles have none left to pay.
 */
export function unpaidTerrainCost(
    { map, tileSet }: TrackData,
    state: ConstructionState,
    locationId: string
): number {
    const tile = new RailwayMapState(map, tileSet, state.tileInventory).tile(locationId)
    if (tile.placement) return 0
    return (map.location(locationId).terrain?.cost ?? 0) + (tile.face.upgradeCost ?? 0)
}

/**
 * Every lay or upgrade costs at least the minimum, or its terrain if more, plus its hexsides. A
 * title may print a lower cost for a hex's terrain, which applies only while it is unpaid.
 */
export function minimumLayCost(
    rules: TrackData,
    minimum: number,
    discountedTerrain?: (state: ConstructionState, request: TrackRequest, terrain: number) => number
): NonNullable<TrackRules['terrainCost']> {
    return (state, request, cost) => {
        const unpaid = unpaidTerrainCost(rules, state, request.locationId)
        const terrain =
            unpaid && discountedTerrain ? discountedTerrain(state, request, unpaid) : unpaid
        return cost - unpaid + Math.max(minimum, terrain)
    }
}
