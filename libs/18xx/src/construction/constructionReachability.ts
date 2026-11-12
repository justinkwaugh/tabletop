import { assertExists } from '@tabletop/common'
import type { RailwayMapState } from '../map/mapState.js'
import { cityIsBlocked, companyStationCenters, type StationState } from '../map/station.js'
import type { RevenueCenter } from '../routes/route.js'
import type { TileEdge, TileEndpoint, TileFace, TileNode } from '../tiles/tile.js'
import { rotateTileFace, sameTileEndpoint } from '../tiles/topology.js'
import { continueStretch, type RunningGauge, type StretchGauge } from '../tiles/trackGauge.js'
import { reachRoutes } from './routeReach.js'

export type ConstructionConnections = { paths: ReadonlySet<string>; nodes: ReadonlySet<string> }

export class ConstructionReachability {
    private readonly reachable = new Set<string>()
    private readonly entries = new Map<string, { edge: TileEdge; gauge: RunningGauge }[]>()

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
                entered: (locationId, edge, gauge) => {
                    this.reachable.add(locationId)
                    this.entries.set(locationId, [
                        ...(this.entries.get(locationId) ?? []),
                        { edge, gauge }
                    ])
                }
            }
        )
    }

    canReach(locationId: string): boolean {
        return this.reachable.has(locationId)
    }

    // A replacement face is connected from the sides routes enter its location by, on the gauge they
    // arrive on, and from the company's stations on it; track a route could only reach by leaving
    // the location and coming back is not counted.
    connections(
        locationId: string,
        face: TileFace,
        stations: StationState
    ): ConstructionConnections {
        const blocked = this.blocked(stations)
        type Arrival = { endpoint: TileEndpoint; gauge: StretchGauge }
        const queue: Arrival[] = [
            ...(this.entries.get(locationId) ?? []).map(({ edge, gauge }): Arrival => ({
                endpoint: { kind: 'edge', edge },
                gauge
            })),
            ...this.origins(stations)
                .filter((origin) => origin.locationId === locationId)
                .map(({ nodeId }): Arrival => ({
                    endpoint: { kind: 'node', nodeId },
                    gauge: 'either'
                }))
        ]
        const visited = new Set<string>()
        const paths = new Set<string>()
        const nodes = new Set<string>()
        for (let index = 0; index < queue.length; index++) {
            const { endpoint, gauge } = queue[index]
            const key = `${endpoint.kind === 'edge' ? `e${endpoint.edge}` : `n${endpoint.nodeId}`} ${gauge}`
            if (visited.has(key)) continue
            visited.add(key)
            if (endpoint.kind === 'node') {
                nodes.add(endpoint.nodeId)
                const node = this.node(face, endpoint.nodeId)
                if (node.kind === 'offboard' || blocked(locationId, node)) continue
            }
            for (const path of face.paths) {
                if (!path.endpoints.some((end) => sameTileEndpoint(end, endpoint))) continue
                const continued = continueStretch(gauge, path)
                if (!continued) continue
                paths.add(path.id)
                for (const end of path.endpoints)
                    if (end.kind === 'node')
                        queue.push({
                            endpoint: end,
                            gauge:
                                this.node(face, end.nodeId).kind === 'junction'
                                    ? continued
                                    : 'either'
                        })
            }
        }
        return { paths, nodes }
    }

    private node(face: TileFace, nodeId: string): TileNode {
        const node = face.nodes.find((node) => node.id === nodeId)
        assertExists(node, `Track ends at a node on the tile: ${nodeId}`)
        return node
    }

    private origins(stations: StationState): RevenueCenter[] {
        return companyStationCenters(stations, this.companyId)
    }

    private blocked(stations: StationState) {
        return (locationId: string, node: TileNode) =>
            cityIsBlocked(stations, this.companyId, locationId, node) ||
            this.closedStop(locationId, node.id)
    }
}
