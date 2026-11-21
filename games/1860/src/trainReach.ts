import {
    rotateTileFace,
    tileEdgeKey,
    tilePathsAtEndpoint,
    type RailwayMapState,
    type RevenueCenter,
    type TileEndpoint,
    type TileFace,
    type TileNode
} from '@tabletop/18xx'

/** A place a run may be: a revenue center or junction, or one side of a hex side. */
type Vertex = string
const nodeVertex = (locationId: string, nodeId: string): Vertex => `${locationId}|node|${nodeId}`
const edgeVertex = (locationId: string, endpoint: Extract<TileEndpoint, { kind: 'edge' }>) =>
    `${locationId}|edge|${tileEdgeKey(endpoint)}`

function endpointVertex(locationId: string, endpoint: TileEndpoint): Vertex {
    return endpoint.kind === 'node'
        ? nodeVertex(locationId, endpoint.nodeId)
        : edgeVertex(locationId, endpoint)
}

/** Large stations and off-board areas count against a train's first number. */
function countsAsLarge(node: TileNode): boolean {
    return node.kind === 'city' || node.kind === 'offboard'
}

export type ReachMap = {
    mapState: RailwayMapState
    /** The face at a location as the search sees it, rotated: the board, or a tile laid there. */
    face(locationId: string): TileFace
    /** Whether a run may pass on through the stop, as it may not through a tokened-out city. */
    passable(locationId: string, node: TileNode): boolean
}

/**
 * What the company's largest train reaches: for each path and stop, the fewest large stations
 * counted on the way there from a base, the base's own station included. A run may pass small
 * stations and halts without stopping, so only large stations limit how far it goes (Upgrading
 * Track).
 */
export class TrainReach {
    private readonly cities = new Map<Vertex, number>()
    private readonly pathCities = new Map<string, number>()

    constructor(
        private readonly reachMap: ReachMap,
        origins: readonly RevenueCenter[],
        private readonly largeStations: number
    ) {
        this.search(origins)
    }

    /** Whether the train can run along the path, at most its allowance of large stations away. */
    reachesPath(locationId: string, pathId: string): boolean {
        const cities = this.pathCities.get(`${locationId}|${pathId}`)
        return cities !== undefined && cities <= this.largeStations
    }

    /** Whether the train can call at the stop within its allowance of large stations. */
    reachesStop(locationId: string, nodeId: string): boolean {
        const cities = this.cities.get(nodeVertex(locationId, nodeId))
        return cities !== undefined && cities <= this.largeStations
    }

    private search(origins: readonly RevenueCenter[]): void {
        const queue: { vertex: Vertex; cities: number }[] = []
        const visit = (vertex: Vertex, cities: number) => {
            const known = this.cities.get(vertex)
            if (known !== undefined && known <= cities) return
            if (cities > this.largeStations) return
            this.cities.set(vertex, cities)
            queue.push({ vertex, cities })
        }
        for (const origin of origins) visit(nodeVertex(origin.locationId, origin.nodeId), 1)
        while (queue.length) {
            queue.sort((a, b) => a.cities - b.cities)
            const next = queue.shift()
            if (!next || this.cities.get(next.vertex) !== next.cities) continue
            const [locationId, kind, key] = next.vertex.split('|')
            const face = this.reachMap.face(locationId)
            if (kind === 'node') {
                const node = face.nodes.find((entry) => entry.id === key)
                const origin = origins.some(
                    (entry) => entry.locationId === locationId && entry.nodeId === key
                )
                if (!node || (!origin && !this.reachMap.passable(locationId, node))) continue
            } else {
                // Crossing the hex side reaches the neighbour's side at once, where the
                // neighbour's face, a tile being laid included, has track at that side.
                const edge = face.paths
                    .flatMap((path) => path.endpoints)
                    .find((endpoint) => endpoint.kind === 'edge' && tileEdgeKey(endpoint) === key)
                const crossing =
                    edge?.kind === 'edge'
                        ? this.reachMap.mapState.map.across(locationId, edge.edge)
                        : undefined
                if (
                    crossing &&
                    tilePathsAtEndpoint(this.reachMap.face(crossing.location.id), {
                        kind: 'edge',
                        edge: crossing.edge
                    }).length
                )
                    visit(
                        edgeVertex(crossing.location.id, { kind: 'edge', edge: crossing.edge }),
                        next.cities
                    )
            }
            for (const path of face.paths) {
                const [a, b] = path.endpoints
                const from = endpointVertex(locationId, a) === next.vertex ? a : undefined
                const to = from ? b : endpointVertex(locationId, b) === next.vertex ? a : undefined
                if (!to) continue
                const node =
                    to.kind === 'node'
                        ? face.nodes.find((entry) => entry.id === to.nodeId)
                        : undefined
                // A run along the path counts the large station it leads into.
                const cities = next.cities + (node && countsAsLarge(node) ? 1 : 0)
                if (cities > this.largeStations) continue
                const pathKey = `${locationId}|${path.id}`
                this.pathCities.set(
                    pathKey,
                    Math.min(this.pathCities.get(pathKey) ?? Infinity, cities)
                )
                visit(endpointVertex(locationId, to), cities)
            }
        }
    }
}

/** The board's faces, rotated, with one location's face replaced, as by a tile being laid. */
export function boardFaces(
    mapState: RailwayMapState,
    replaced?: { locationId: string; face: TileFace }
): (locationId: string) => TileFace {
    return (locationId) => {
        if (replaced?.locationId === locationId) return replaced.face
        const tile = mapState.tile(locationId)
        return rotateTileFace(tile.face, tile.rotation)
    }
}
