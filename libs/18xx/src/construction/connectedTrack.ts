import { assertExists } from '@tabletop/common'
import type { RevenueCenter } from '../routes/route.js'
import type { RailwayMapState } from '../map/mapState.js'
import type { TileEndpoint, TileFace, TileNode } from '../tiles/tile.js'
import { rotateTileFace } from '../tiles/topology.js'
import { reachRoutes } from './routeReach.js'

export class ConnectedTrack {
    private readonly blocked = new Map<string, Set<string>>()
    private readonly reached = new Map<string, Set<string>>()
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
        const face = (locationId: string) => {
            const face = faces.get(locationId)
            assertExists(face, `Unknown map location: ${locationId}`)
            return face
        }
        reachRoutes(mapState.map, face, origins, blocked, {
            reached: (locationId, endpoint) => add(this.reached, locationId, endpointKey(endpoint)),
            used: (locationId, pathId) => add(this.paths, locationId, pathId),
            blocked: (locationId, node) => add(this.blocked, locationId, node.id)
        })
    }
    isBlocked(locationId: string, nodeId: string): boolean {
        return this.blocked.get(locationId)?.has(nodeId) ?? false
    }
    reaches(locationId: string, endpoint: TileEndpoint): boolean {
        return this.reached.get(locationId)?.has(endpointKey(endpoint)) ?? false
    }
    usesPath(locationId: string, pathId: string): boolean {
        return this.paths.get(locationId)?.has(pathId) ?? false
    }
}

function add(sets: Map<string, Set<string>>, locationId: string, value: string): void {
    sets.set(locationId, (sets.get(locationId) ?? new Set<string>()).add(value))
}

function endpointKey(endpoint: TileEndpoint): string {
    return endpoint.kind === 'edge' ? `edge ${endpoint.edge}` : `node ${endpoint.nodeId}`
}
