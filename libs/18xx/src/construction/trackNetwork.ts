import type { RailwayMapState } from '../map/mapState.js'
import type { StationState } from '../map/station.js'
import type { TileEndpoint, TileFace } from '../tiles/tile.js'
import { rotateTileEdge, rotateTileFace, sameTileEndpoint } from '../tiles/topology.js'

export class TrackNetwork {
    private readonly blocked = new Map<string, Set<string>>()
    private readonly reached = new Map<string, TileEndpoint[]>()
    private readonly paths = new Map<string, Set<string>>()
    constructor(
        mapState: RailwayMapState,
        state: StationState,
        companyId: string,
        replacement?: { locationId: string; face: TileFace }
    ) {
        const faces = new Map(
            mapState.map.definition.locations.map(({ id }) => {
                const tile = mapState.tile(id)
                return [
                    id,
                    replacement?.locationId === id
                        ? replacement.face
                        : rotateTileFace(tile.face, tile.rotation)
                ] as const
            })
        )
        const queue = state.stations.flatMap((station) =>
            station.status === 'placed' && station.companyId === companyId
                ? [
                      {
                          locationId: station.position.locationId,
                          endpoint: {
                              kind: 'node',
                              nodeId: station.position.nodeId
                          } satisfies TileEndpoint
                      }
                  ]
                : []
        )
        const pending: { locationId: string; endpoint: TileEndpoint }[] = [...queue]
        while (pending.length) {
            const { locationId, endpoint } = pending.shift()!
            const ends = this.reached.get(locationId) ?? []
            if (ends.some((end) => sameTileEndpoint(end, endpoint))) continue
            ends.push(endpoint)
            this.reached.set(locationId, ends)
            const face = faces.get(locationId)!
            if (endpoint.kind === 'node') {
                const node = face.nodes.find((node) => node.id === endpoint.nodeId)!
                const stations = state.stations.filter(
                    (station) =>
                        station.status === 'placed' &&
                        station.position.locationId === locationId &&
                        station.position.nodeId === endpoint.nodeId
                )
                if (
                    node.kind === 'city' &&
                    node.stationSlots > 0 &&
                    stations.length >= node.stationSlots &&
                    !stations.some((station) => station.companyId === companyId)
                ) {
                    const blocked = this.blocked.get(locationId) ?? new Set<string>()
                    blocked.add(node.id)
                    this.blocked.set(locationId, blocked)
                    continue
                }
            }
            const paths = this.paths.get(locationId) ?? new Set<string>()
            for (const path of face.paths) {
                if (!path.endpoints.some((end) => sameTileEndpoint(end, endpoint))) continue
                paths.add(path.id)
                for (const end of path.endpoints) pending.push({ locationId, endpoint: end })
            }
            this.paths.set(locationId, paths)
            if (endpoint.kind !== 'edge') continue
            const neighbor = mapState.map.neighbor(locationId, endpoint.edge)
            if (!neighbor) continue
            const opposite = rotateTileEdge(endpoint.edge, 3)
            if (
                mapState.map
                    .location(locationId)
                    .borders?.some(
                        (border) => border.edge === endpoint.edge && border.kind === 'impassable'
                    ) ||
                neighbor.borders?.some(
                    (border) => border.edge === opposite && border.kind === 'impassable'
                )
            )
                continue
            const other: TileEndpoint = { kind: 'edge', edge: opposite }
            if (
                faces
                    .get(neighbor.id)!
                    .paths.some((path) =>
                        path.endpoints.some((end) => sameTileEndpoint(end, other))
                    )
            )
                pending.push({ locationId: neighbor.id, endpoint: other })
        }
    }
    isBlocked(locationId: string, nodeId: string): boolean {
        return this.blocked.get(locationId)?.has(nodeId) ?? false
    }
    reaches(locationId: string, endpoint: TileEndpoint): boolean {
        return this.reached.get(locationId)?.some((end) => sameTileEndpoint(end, endpoint)) ?? false
    }
    usesPath(locationId: string, pathId: string): boolean {
        return this.paths.get(locationId)?.has(pathId) ?? false
    }
}
