import { assert, assertExists } from '@tabletop/common'
import type { RailwayMap } from './map.js'
import type { StationState } from './station.js'
import { TileInventory, type TilePlacement, type TileSet } from '../tiles/inventory.js'
import type { TileEdge, TileFace, TileRotation } from '../tiles/tile.js'
import { rotateTileEdge, rotateTileFace, tilePathsAtEndpoint } from '../tiles/topology.js'

export const MapFields = { tileInventory: TileInventory }
export type MapStateData = StationState & { tileInventory: TileInventory }
export type MapTile = {
    face: TileFace
    rotation: TileRotation
    placement?: TilePlacement
}
export type MapTrackConnection = {
    edge: TileEdge
    neighborLocationId: string
    neighborEdge: TileEdge
}

export class RailwayMapState {
    private readonly tiles = new Map<string, MapTile>()
    constructor(
        readonly map: RailwayMap,
        tileSet: TileSet,
        inventory: TileInventory
    ) {
        const parsed = tileSet.parseInventory(inventory)
        const definitions = new Map(
            tileSet.definitions.map((definition) => [definition.id, definition])
        )
        for (const locationId of Object.keys(parsed.placements)) map.location(locationId)
        for (const location of map.definition.locations) {
            const placement = parsed.placements[location.id]
            if (placement) {
                const definition = definitions.get(placement.definitionId)
                assertExists(definition, 'Placed map tile requires a definition')
                this.tiles.set(location.id, {
                    face: definition.face,
                    rotation: placement.rotation,
                    placement
                })
            } else this.tiles.set(location.id, { face: location.preprintedTile, rotation: 0 })
        }
    }
    tile(locationId: string): MapTile {
        const tile = this.tiles.get(locationId)
        assertExists(tile, `Unknown map location: ${locationId}`)
        return tile
    }
    connections(locationId: string): MapTrackConnection[] {
        const tile = this.tile(locationId)
        const face = rotateTileFace(tile.face, tile.rotation)
        const edges = new Set(
            face.paths.flatMap((path) =>
                path.endpoints.flatMap((endpoint) =>
                    endpoint.kind === 'edge' ? [endpoint.edge] : []
                )
            )
        )
        const connections: MapTrackConnection[] = []
        for (const edge of edges) {
            const neighbor = this.map.neighbor(locationId, edge)
            if (!neighbor) continue
            const neighborEdge = rotateTileEdge(edge, 3)
            if (
                this.map
                    .location(locationId)
                    .borders?.some(
                        (border) => border.edge === edge && border.kind === 'impassable'
                    ) ||
                neighbor.borders?.some(
                    (border) => border.edge === neighborEdge && border.kind === 'impassable'
                )
            )
                continue
            const adjacent = this.tile(neighbor.id)
            if (
                tilePathsAtEndpoint(rotateTileFace(adjacent.face, adjacent.rotation), {
                    kind: 'edge',
                    edge: neighborEdge
                }).length
            )
                connections.push({ edge, neighborLocationId: neighbor.id, neighborEdge })
        }
        return connections
    }
    validateStations(state: StationState): void {
        for (const station of state.stations) {
            if (station.status !== 'placed') continue
            const { locationId, nodeId, slot } = station.position
            const node = this.tile(locationId).face.nodes.find((node) => node.id === nodeId)
            assert(
                node?.kind === 'city' && slot < node.stationSlots,
                'Station requires an existing city slot'
            )
        }
        for (const reservation of state.stationReservations) {
            const node = this.tile(reservation.locationId).face.nodes.find(
                (node) => node.id === reservation.nodeId
            )
            assert(node?.kind === 'city', 'Station reservation requires an existing city')
        }
    }
}
