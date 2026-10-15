import type { RevenueCenter } from '../routes/route.js'
import type { RailwayMapState } from '../map/mapState.js'
import type { TileEndpoint, TileFace, TileNode } from '../tiles/tile.js'
import { rotateTileFace, sameTileEndpoint } from '../tiles/topology.js'
import { reachRoutes } from './routeReach.js'

export class ConnectedTrack {
    private readonly blocked = new Map<string, Set<string>>()
    private readonly reached = new Map<string, TileEndpoint[]>()
    private readonly paths = new Map<string, Set<string>>()
    constructor(
        mapState: RailwayMapState,
        origins: readonly RevenueCenter[],
        blocked: (locationId: string, node: TileNode) => boolean = () => false,
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
        reachRoutes(mapState.map, (locationId) => faces.get(locationId)!, origins, blocked, {
            reached: (locationId, endpoint) => {
                const ends = this.reached.get(locationId) ?? []
                if (!ends.some((end) => sameTileEndpoint(end, endpoint))) ends.push(endpoint)
                this.reached.set(locationId, ends)
            },
            used: (locationId, pathId) => {
                const paths = this.paths.get(locationId) ?? new Set<string>()
                paths.add(pathId)
                this.paths.set(locationId, paths)
            },
            stopped: (locationId, node) => {
                const blocked = this.blocked.get(locationId) ?? new Set<string>()
                blocked.add(node.id)
                this.blocked.set(locationId, blocked)
            }
        })
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
