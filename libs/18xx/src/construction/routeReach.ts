import type { RailwayMap } from '../map/map.js'
import type { RevenueCenter } from '../routes/route.js'
import type { TileEdge, TileEndpoint, TileFace, TileNode } from '../tiles/tile.js'
import { rotateTileEdge } from '../tiles/topology.js'

export type RouteVisitor = {
    entered?(locationId: string, edge?: TileEdge): void
    reached?(locationId: string, endpoint: TileEndpoint): void
    used?(locationId: string, pathId: string): void
    stopped?(locationId: string, node: TileNode): void
}

// Finds everything a legal route from the origins can reach: no stop, track or hex side used twice,
// and no turning back at a hex side. Routes become alternating paths in a graph where every vertex
// but the start is matched:
// - a hex side is a matched pair, one vertex per tile, each joined to that tile's track there, so a
//   route crosses the side and cannot turn onto other track on the same tile;
// - a stop is a matched pair with its track joined to both, so a route passes it once, by
//   different track; a stop the route cannot pass has its track joined to one vertex only;
// - each path is a matched pair between its ends, so following it in a direction reaches the far
//   vertex of the pair;
// - the start joins each origin's pair.
// A vertex is reached by an alternating path ending in its matched edge exactly when Edmonds' search
// from the start labels it outer.
export function reachRoutes(
    map: RailwayMap,
    face: (locationId: string) => TileFace,
    origins: readonly RevenueCenter[],
    blocked: (locationId: string, node: TileNode) => boolean,
    visitor: RouteVisitor
): void {
    const graph = new AlternatingGraph()
    const start = graph.vertex()
    const sides = new Map<string, number>()
    const stopVertices = new Map<string, { first: number; second: number; wall: boolean }>()
    const pathVertices: {
        locationId: string
        pathId: string
        towards: [number, number]
    }[] = []
    const sideCrossings: {
        locationId: string
        edge: TileEdge
        other: number
        neighbor?: { locationId: string; edge: TileEdge; tracked: boolean }
    }[] = []

    const sideVertex = (locationId: string, edge: TileEdge): number => {
        const key = `${locationId} ${edge}`
        let vertex = sides.get(key)
        if (vertex !== undefined) return vertex
        vertex = graph.vertex()
        sides.set(key, vertex)
        const neighbor = map.neighbor(locationId, edge)
        const opposite = rotateTileEdge(edge, 3)
        const passable =
            neighbor &&
            !map
                .location(locationId)
                .borders?.some((border) => border.edge === edge && border.kind === 'impassable') &&
            !neighbor.borders?.some(
                (border) => border.edge === opposite && border.kind === 'impassable'
            )
        if (!passable) {
            const dead = graph.vertex()
            graph.match(vertex, dead)
            sideCrossings.push({ locationId, edge, other: dead })
            return vertex
        }
        const other = graph.vertex()
        sides.set(`${neighbor.id} ${opposite}`, other)
        graph.match(vertex, other)
        const tracked = (id: string, side: TileEdge) =>
            face(id).paths.some((path) =>
                path.endpoints.some((end) => end.kind === 'edge' && end.edge === side)
            )
        sideCrossings.push({
            locationId,
            edge,
            other,
            neighbor: {
                locationId: neighbor.id,
                edge: opposite,
                tracked: tracked(neighbor.id, opposite)
            }
        })
        sideCrossings.push({
            locationId: neighbor.id,
            edge: opposite,
            other: vertex,
            neighbor: { locationId, edge, tracked: tracked(locationId, edge) }
        })
        return vertex
    }

    const stopVertex = (locationId: string, nodeId: string) => {
        const key = `${locationId} ${nodeId}`
        let pair = stopVertices.get(key)
        if (!pair) {
            const node = face(locationId).nodes.find((node) => node.id === nodeId)!
            pair = {
                first: graph.vertex(),
                second: graph.vertex(),
                wall: blocked(locationId, node)
            }
            graph.match(pair.first, pair.second)
            stopVertices.set(key, pair)
        }
        return pair
    }

    const attach = (vertex: number, locationId: string, end: TileEndpoint) => {
        if (end.kind === 'edge') graph.join(vertex, sideVertex(locationId, end.edge))
        else {
            const pair = stopVertex(locationId, end.nodeId)
            graph.join(vertex, pair.first)
            if (!pair.wall) graph.join(vertex, pair.second)
        }
    }

    for (const { id: locationId } of map.definition.locations) {
        for (const path of face(locationId).paths) {
            // Following the path from its first end reaches `second`; from its second end, `first`.
            const first = graph.vertex()
            const second = graph.vertex()
            graph.match(first, second)
            attach(first, locationId, path.endpoints[0])
            attach(second, locationId, path.endpoints[1])
            pathVertices.push({
                locationId,
                pathId: path.id,
                towards: [first, second]
            })
        }
    }
    for (const { locationId, nodeId } of origins) {
        const pair = stopVertex(locationId, nodeId)
        graph.join(start, pair.first)
        graph.join(start, pair.second)
    }

    const outer = graph.outerFrom(start)

    for (const { locationId, nodeId } of origins) {
        visitor.entered?.(locationId)
        visitor.reached?.(locationId, { kind: 'node', nodeId })
    }
    for (const [key, pair] of stopVertices) {
        if (!outer[pair.first] && !outer[pair.second]) continue
        const [locationId, nodeId] = key.split(' ')
        visitor.reached?.(locationId, { kind: 'node', nodeId })
        if (pair.wall) {
            visitor.stopped?.(
                locationId,
                face(locationId).nodes.find((node) => node.id === nodeId)!
            )
        }
    }
    for (const { locationId, pathId, towards } of pathVertices) {
        if (outer[towards[0]] || outer[towards[1]]) visitor.used?.(locationId, pathId)
    }
    for (const { locationId, edge, other, neighbor } of sideCrossings) {
        // The far vertex is reached across its matched edge exactly when a route reaches this side
        // from inside the tile.
        if (!outer[other]) continue
        visitor.reached?.(locationId, { kind: 'edge', edge })
        if (!neighbor) continue
        visitor.entered?.(neighbor.locationId, neighbor.edge)
        if (neighbor.tracked)
            visitor.reached?.(neighbor.locationId, { kind: 'edge', edge: neighbor.edge })
    }
}

// An undirected graph with a matching, searched from one unmatched vertex for the vertices an
// alternating path reaches across their matched edge (Edmonds' blossom search).
class AlternatingGraph {
    private readonly neighbors: number[][] = []
    private readonly mates: number[] = []

    vertex(): number {
        this.neighbors.push([])
        this.mates.push(-1)
        return this.neighbors.length - 1
    }

    join(a: number, b: number): void {
        this.neighbors[a].push(b)
        this.neighbors[b].push(a)
    }

    match(a: number, b: number): void {
        this.mates[a] = b
        this.mates[b] = a
    }

    outerFrom(root: number): boolean[] {
        const count = this.neighbors.length
        const mate = this.mates
        const parent = new Int32Array(count).fill(-1)
        const base = Int32Array.from({ length: count }, (_, vertex) => vertex)
        const outer: boolean[] = new Array(count).fill(false)
        const queue = [root]
        outer[root] = true

        const commonBase = (a: number, b: number): number => {
            const seen = new Uint8Array(count)
            for (;;) {
                a = base[a]
                seen[a] = 1
                if (mate[a] === -1) break
                a = parent[mate[a]]
            }
            for (;;) {
                b = base[b]
                if (seen[b]) return b
                b = parent[mate[b]]
            }
        }

        for (let index = 0; index < queue.length; index++) {
            const vertex = queue[index]
            for (const next of this.neighbors[vertex]) {
                if (base[vertex] === base[next] || mate[vertex] === next) continue
                if (next === root || (mate[next] !== -1 && parent[mate[next]] !== -1)) {
                    const blossomBase = commonBase(vertex, next)
                    const inBlossom = new Uint8Array(count)
                    const markPath = (from: number, child: number) => {
                        while (base[from] !== blossomBase) {
                            inBlossom[base[from]] = 1
                            inBlossom[base[mate[from]]] = 1
                            parent[from] = child
                            child = mate[from]
                            from = parent[mate[from]]
                        }
                    }
                    markPath(vertex, next)
                    markPath(next, vertex)
                    for (let other = 0; other < count; other++) {
                        if (!inBlossom[base[other]]) continue
                        base[other] = blossomBase
                        if (!outer[other]) {
                            outer[other] = true
                            queue.push(other)
                        }
                    }
                } else if (parent[next] === -1) {
                    parent[next] = vertex
                    // Every vertex but the root is matched, so no augmenting path exists.
                    const mateOfNext = mate[next]
                    if (!outer[mateOfNext]) {
                        outer[mateOfNext] = true
                        queue.push(mateOfNext)
                    }
                }
            }
        }
        return outer
    }
}
