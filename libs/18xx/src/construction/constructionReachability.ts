import { assertExists } from '@tabletop/common'
import type { RailwayMapState } from '../map/mapState.js'
import { cityIsBlocked, type StationState } from '../map/station.js'
import type { RevenueCenter } from '../routes/route.js'
import type { TileEdge, TileEndpoint, TileFace, TileNode } from '../tiles/tile.js'
import { rotateTileFace, sameTileEndpoint } from '../tiles/topology.js'
import { reachRoutes } from './routeReach.js'

export type ConstructionConnections = { paths: ReadonlySet<string>; nodes: ReadonlySet<string> }

export class ConstructionReachability {
    private readonly reachable = new Set<string>()
    private readonly entries = new Map<string, Set<TileEdge>>()

    constructor(
        mapState: RailwayMapState,
        stations: StationState,
        private readonly companyId: string,
        private readonly closedStop: (locationId: string, nodeId: string) => boolean = () => false
    ) {
        const faces = new Map<string, TileFace>()
        for (const { id } of mapState.map.definition.locations) {
            const tile = mapState.tile(id)
            faces.set(id, rotateTileFace(tile.face, tile.rotation))
        }
        reachRoutes(
            mapState.map,
            (locationId) => {
                const face = faces.get(locationId)
                assertExists(face, `Unknown map location: ${locationId}`)
                return face
            },
            this.origins(stations),
            this.blocked(stations),
            {
                reached: (locationId) => this.reachable.add(locationId),
                entered: (locationId, edge) => {
                    this.reachable.add(locationId)
                    const edges = this.entries.get(locationId) ?? new Set<TileEdge>()
                    this.entries.set(locationId, edges.add(edge))
                }
            }
        )
    }

    canReach(locationId: string): boolean {
        return this.reachable.has(locationId)
    }

    // A replacement face is connected from the sides routes enter its location by and from the
    // company's stations on it; track a route could only reach by leaving the location and coming
    // back is not counted.
    connections(
        locationId: string,
        face: TileFace,
        stations: StationState
    ): ConstructionConnections {
        const blocked = this.blocked(stations)
        const queue: TileEndpoint[] = [
            ...[...(this.entries.get(locationId) ?? [])].map(
                (edge) => ({ kind: 'edge', edge }) satisfies TileEndpoint
            ),
            ...this.origins(stations)
                .filter((origin) => origin.locationId === locationId)
                .map(({ nodeId }) => ({ kind: 'node', nodeId }) satisfies TileEndpoint)
        ]
        const visited = new Set<string>()
        const paths = new Set<string>()
        const nodes = new Set<string>()
        for (let index = 0; index < queue.length; index++) {
            const endpoint = queue[index]
            const key = endpoint.kind === 'edge' ? `e${endpoint.edge}` : `n${endpoint.nodeId}`
            if (visited.has(key)) continue
            visited.add(key)
            if (endpoint.kind === 'node') {
                nodes.add(endpoint.nodeId)
                const node = face.nodes.find((node) => node.id === endpoint.nodeId)
                assertExists(node, `Track ends at a node on the tile: ${endpoint.nodeId}`)
                if (node.kind === 'offboard' || blocked(locationId, node)) continue
            }
            for (const path of face.paths) {
                if (!path.endpoints.some((end) => sameTileEndpoint(end, endpoint))) continue
                paths.add(path.id)
                for (const end of path.endpoints) if (end.kind === 'node') queue.push(end)
            }
        }
        return { paths, nodes }
    }

    private origins(stations: StationState): RevenueCenter[] {
        return stations.stations.flatMap((station) =>
            station.status === 'placed' && station.companyId === this.companyId
                ? [{ locationId: station.position.locationId, nodeId: station.position.nodeId }]
                : []
        )
    }

    private blocked(stations: StationState) {
        return (locationId: string, node: TileNode) =>
            cityIsBlocked(stations, this.companyId, locationId, node) ||
            this.closedStop(locationId, node.id)
    }
}
