import type { RailwayMapState } from '../map/mapState.js'
import { cityIsBlocked, type StationState } from '../map/station.js'
import type { TileEdge, TileEndpoint, TileFace } from '../tiles/tile.js'
import { rotateTileEdge, rotateTileFace, sameTileEndpoint } from '../tiles/topology.js'

type Visit = { locationId: string; endpoint: TileEndpoint; exiting: boolean }
type Boundary = { entries: readonly TileEdge[]; returns: Map<TileEdge, readonly TileEdge[]> }
export type ConstructionConnections = { paths: ReadonlySet<string>; nodes: ReadonlySet<string> }

export class ConstructionReachability {
    private readonly faces = new Map<string, TileFace>()
    private readonly origins: Visit[]
    private readonly boundaries = new Map<string, Boundary>()
    private readonly accessible = new Set<string>()

    constructor(
        private readonly mapState: RailwayMapState,
        private readonly stations: StationState,
        private readonly companyId: string
    ) {
        for (const { id } of mapState.map.definition.locations) {
            const tile = mapState.tile(id)
            this.faces.set(id, rotateTileFace(tile.face, tile.rotation))
        }
        this.origins = stations.stations.flatMap((station) =>
            station.status === 'placed' && station.companyId === companyId
                ? [
                      {
                          locationId: station.position.locationId,
                          endpoint: {
                              kind: 'node',
                              nodeId: station.position.nodeId
                          } satisfies TileEndpoint,
                          exiting: false
                      }
                  ]
                : []
        )
        this.walk(this.origins)
    }

    canReach(locationId: string): boolean {
        return this.accessible.has(locationId)
    }

    connections(
        locationId: string,
        face: TileFace,
        stations: StationState
    ): ConstructionConnections {
        let boundary = this.boundaries.get(locationId)
        if (!boundary) {
            boundary = {
                entries: this.walk(
                    this.origins.filter((origin) => origin.locationId !== locationId),
                    locationId
                ),
                returns: new Map()
            }
            this.boundaries.set(locationId, boundary)
        }
        const queue: TileEndpoint[] = boundary.entries.map((edge) => ({ kind: 'edge', edge }))
        for (const station of stations.stations) {
            if (
                station.status === 'placed' &&
                station.companyId === this.companyId &&
                station.position.locationId === locationId
            )
                queue.push({ kind: 'node', nodeId: station.position.nodeId })
        }
        const visited = new Set<string>()
        const paths = new Set<string>()
        const nodes = new Set<string>()
        for (let index = 0; index < queue.length; index++) {
            const endpoint = queue[index]
            const key = this.endpointKey(endpoint)
            if (visited.has(key)) continue
            visited.add(key)
            if (endpoint.kind === 'node') {
                nodes.add(endpoint.nodeId)
                const node = face.nodes.find((node) => node.id === endpoint.nodeId)!
                if (cityIsBlocked(stations, this.companyId, locationId, node)) continue
            }
            for (const path of face.paths) {
                if (!path.endpoints.some((end) => sameTileEndpoint(end, endpoint))) continue
                paths.add(path.id)
                for (const end of path.endpoints) {
                    if (sameTileEndpoint(end, endpoint)) continue
                    if (end.kind === 'node') queue.push(end)
                    else {
                        let returns = boundary.returns.get(end.edge)
                        if (!returns) {
                            const neighbor = this.cross(locationId, end.edge)
                            returns = neighbor ? this.walk([neighbor], locationId) : []
                            boundary.returns.set(end.edge, returns)
                        }
                        for (const edge of returns) queue.push({ kind: 'edge', edge })
                    }
                }
            }
        }
        return { paths, nodes }
    }

    private endpointKey(endpoint: TileEndpoint): string {
        return endpoint.kind === 'edge' ? `e${endpoint.edge}` : `n${endpoint.nodeId}`
    }

    private cross(locationId: string, edge: TileEdge): Visit | undefined {
        const neighbor = this.mapState.map.neighbor(locationId, edge)
        if (!neighbor) return undefined
        const opposite = rotateTileEdge(edge, 3)
        if (
            this.mapState.map
                .location(locationId)
                .borders?.some((border) => border.edge === edge && border.kind === 'impassable') ||
            neighbor.borders?.some(
                (border) => border.edge === opposite && border.kind === 'impassable'
            )
        )
            return undefined
        return {
            locationId: neighbor.id,
            endpoint: { kind: 'edge', edge: opposite },
            exiting: false
        }
    }

    private walk(seeds: readonly Visit[], excluded?: string): TileEdge[] {
        const queue = [...seeds]
        const visited = new Set<string>()
        const boundary = new Set<TileEdge>()
        for (let index = 0; index < queue.length; index++) {
            const visit = queue[index]
            const { locationId, endpoint, exiting } = visit
            if (locationId === excluded) {
                if (endpoint.kind === 'edge') boundary.add(endpoint.edge)
                continue
            }
            const key = JSON.stringify([locationId, this.endpointKey(endpoint), exiting])
            if (visited.has(key)) continue
            visited.add(key)
            if (!excluded) this.accessible.add(locationId)
            const face = this.faces.get(locationId)!
            if (endpoint.kind === 'node') {
                const node = face.nodes.find((node) => node.id === endpoint.nodeId)!
                if (cityIsBlocked(this.stations, this.companyId, locationId, node)) continue
            }
            if (exiting && endpoint.kind === 'edge') {
                const neighbor = this.cross(locationId, endpoint.edge)
                if (neighbor) queue.push(neighbor)
            } else {
                for (const path of face.paths) {
                    if (!path.endpoints.some((end) => sameTileEndpoint(end, endpoint))) continue
                    for (const end of path.endpoints) {
                        if (!sameTileEndpoint(end, endpoint))
                            queue.push({ locationId, endpoint: end, exiting: end.kind === 'edge' })
                    }
                }
            }
        }
        return [...boundary]
    }
}
