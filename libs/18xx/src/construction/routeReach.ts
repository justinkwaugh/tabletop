import { assertExists } from '@tabletop/common'
import type { RailwayMap } from '../map/map.js'
import type { RevenueCenter } from '../routes/route.js'
import type { TileEdgeEndpoint, TileEndpoint, TileFace, TileNode, TilePath } from '../tiles/tile.js'
import {
    oppositeTileEndpoint,
    sameTileEndpoint,
    terminusNodeId,
    tileEdgeKey
} from '../tiles/topology.js'
import { pathRunningGauges, type RunningGauge } from '../tiles/trackGauge.js'

export type RouteVisitor = {
    entered?(locationId: string, endpoint: TileEdgeEndpoint, gauge: RunningGauge): void
    reached?(locationId: string, endpoint: TileEndpoint): void
    used?(locationId: string, pathId: string): void
    blocked?(locationId: string, node: TileNode): void
}

type Stop = {
    center: RevenueCenter
    node: TileNode
    pair: [number, number]
    passable: boolean
    track: number[]
    // Where a route that reaches the stop along terminus track ends, once any such track exists.
    arrival?: [number, number]
    // The stop's terminus track, each by the vertex a route leaves the stop along it from.
    departures: number[]
}
type Side = {
    locationId: string
    endpoint: TileEdgeEndpoint
    gauge: RunningGauge
    // The vertex across this side's matched edge; a route reaches it by reaching the side.
    beyond: number
    into?: { locationId: string; endpoint: TileEdgeEndpoint; tracked: boolean }
}

// Finds everything a legal route from the origins can reach: no stop, track or hex side used twice,
// no turning back onto other track at a hex side, no passing through a blocked stop or an
// offboard, and no change of gauge between stops. Routes become alternating paths in a graph where
// every vertex but the start is matched:
// - a hex side is a matched pair for each gauge, one vertex per tile, each joined to that tile's
//   track of the gauge there, so a route crosses the side and cannot turn onto other track on the
//   same tile;
// - a stop is a matched pair with its track joined to both, so a route passes it once, by
//   different track; a stop no route may pass has its track joined to one vertex only; a junction,
//   which a route passes on one gauge, is such a pair for each gauge;
// - each path is a matched pair between its ends, so following it in either direction reaches the
//   vertex at the far end; dual track joins the sides and junctions of both gauges, except that
//   dual track between two of them is a pair for each gauge, so a route keeps its gauge along it;
// - the start joins the first vertex of each origin's pair, so a route leaves an origin unless it
//   is blocked; an offboard origin, which no route may pass, has a matched pair of its own for
//   leaving by its track;
// - terminus track is two pairs: one a route arrives along, ending at a matched pair of the stop's
//   that leads nowhere, and one a route leaves along, joined to a matched pair of its own that the
//   start joins once a route may leave the stop that way: from an origin, or from a stop a route
//   reaches by other track and may pass. A hex side's parallel lanes are sides of their own.
// A vertex is reached by an alternating path ending in its matched edge exactly when Edmonds' search
// from the start labels it outer. Where gauges mix, the pairs for each gauge let a route use the same
// dual track or hex side once on each gauge, so reach may overstate what a route can use where
// track of both gauges meets at one hex side or junction. A route that passes a stop to leave along
// its terminus track is not checked against the track it came by, so reach may overstate there too.
export function reachRoutes(
    map: RailwayMap,
    face: (locationId: string) => TileFace,
    origins: readonly RevenueCenter[],
    blocked: (locationId: string, node: TileNode) => boolean,
    visitor: RouteVisitor
): void {
    const graph = new AlternatingGraph()
    const start = graph.vertex()
    const sideVertices = new Map<string, number>()
    const stops = new Map<string, Stop>()
    const sides: Side[] = []
    const paths: { locationId: string; pathId: string; ends: [number, number] }[] = []

    const tracked = (locationId: string, endpoint: TileEdgeEndpoint, gauge: RunningGauge) =>
        face(locationId).paths.some(
            (path) =>
                pathRunningGauges(path).includes(gauge) &&
                path.endpoints.some((end) => sameTileEndpoint(end, endpoint))
        )

    const sideKey = (locationId: string, endpoint: TileEdgeEndpoint, gauge: RunningGauge) =>
        `${locationId} ${tileEdgeKey(endpoint)} ${gauge}`

    const sideVertex = (
        locationId: string,
        endpoint: TileEdgeEndpoint,
        gauge: RunningGauge
    ): number => {
        const existing = sideVertices.get(sideKey(locationId, endpoint, gauge))
        if (existing !== undefined) return existing
        const vertex = graph.vertex()
        const beyond = graph.vertex()
        graph.match(vertex, beyond)
        sideVertices.set(sideKey(locationId, endpoint, gauge), vertex)
        const crossing = map.across(locationId, endpoint.edge)
        if (!crossing) {
            sides.push({ locationId, endpoint, gauge, beyond })
            return vertex
        }
        const into = crossing.location.id
        const opposite = oppositeTileEndpoint(endpoint, crossing.edge)
        sideVertices.set(sideKey(into, opposite, gauge), beyond)
        sides.push({
            locationId,
            endpoint,
            gauge,
            beyond,
            into: {
                locationId: into,
                endpoint: opposite,
                tracked: tracked(into, opposite, gauge)
            }
        })
        sides.push({
            locationId: into,
            endpoint: opposite,
            gauge,
            beyond: vertex,
            into: { locationId, endpoint, tracked: tracked(locationId, endpoint, gauge) }
        })
        return vertex
    }

    const node = (locationId: string, nodeId: string): TileNode => {
        const found = face(locationId).nodes.find((node) => node.id === nodeId)
        assertExists(found, `Track ends at a node on its tile: ${locationId} ${nodeId}`)
        return found
    }

    const stop = (locationId: string, nodeId: string, gauge: RunningGauge): Stop => {
        const stopNode = node(locationId, nodeId)
        const key =
            stopNode.kind === 'junction'
                ? `${locationId} ${nodeId} ${gauge}`
                : `${locationId} ${nodeId}`
        const existing = stops.get(key)
        if (existing) return existing
        const pair: [number, number] = [graph.vertex(), graph.vertex()]
        graph.match(...pair)
        const created: Stop = {
            center: { locationId, nodeId },
            node: stopNode,
            pair,
            passable: stopNode.kind !== 'offboard' && !blocked(locationId, stopNode),
            track: [],
            departures: []
        }
        stops.set(key, created)
        return created
    }

    const arrival = (reached: Stop): [number, number] => {
        if (!reached.arrival) {
            reached.arrival = [graph.vertex(), graph.vertex()]
            graph.match(...reached.arrival)
        }
        return reached.arrival
    }

    const attach = (
        vertex: number,
        locationId: string,
        end: TileEndpoint,
        gauges: readonly RunningGauge[]
    ) => {
        for (const gauge of gauges) {
            if (end.kind === 'edge') {
                graph.join(vertex, sideVertex(locationId, end, gauge))
                continue
            }
            const { node, pair, passable, track } = stop(locationId, end.nodeId, gauge)
            track.push(vertex)
            graph.join(vertex, pair[0])
            if (passable) graph.join(vertex, pair[1])
            if (node.kind !== 'junction') return
        }
    }

    // The path's own pair is the track a route arrives along; a second pair leaves the stop.
    const attachTerminus = (
        locationId: string,
        path: TilePath,
        terminusId: string,
        ends: [number, number],
        gauges: readonly RunningGauge[]
    ) => {
        const stopIndex = path.endpoints.findIndex(
            (end) => end.kind === 'node' && end.nodeId === terminusId
        )
        const far = path.endpoints[1 - stopIndex]
        assertExists(far, 'Terminus track has a far end')
        const reached = stop(locationId, terminusId, gauges[0])
        attach(ends[1 - stopIndex], locationId, far, gauges)
        graph.join(ends[stopIndex], arrival(reached)[0])
        const leaving: [number, number] = [graph.vertex(), graph.vertex()]
        graph.match(...leaving)
        attach(leaving[1], locationId, far, gauges)
        reached.departures.push(leaving[0])
        paths.push({ locationId, pathId: path.id, ends: leaving })
    }

    const atStop = (locationId: string, end: TileEndpoint) =>
        end.kind === 'node' && node(locationId, end.nodeId).kind !== 'junction'

    for (const { id: locationId } of map.definition.locations) {
        for (const path of face(locationId).paths) {
            const gauges = pathRunningGauges(path)
            const layers =
                gauges.length > 1 && !path.endpoints.some((end) => atStop(locationId, end))
                    ? gauges.map((gauge) => [gauge])
                    : [gauges]
            const terminusId = terminusNodeId(path)
            for (const layer of layers) {
                // ends[i] joins the path's endpoint i.
                const ends: [number, number] = [graph.vertex(), graph.vertex()]
                graph.match(...ends)
                paths.push({ locationId, pathId: path.id, ends })
                if (terminusId === undefined) {
                    attach(ends[0], locationId, path.endpoints[0], layer)
                    attach(ends[1], locationId, path.endpoints[1], layer)
                    continue
                }
                attachTerminus(locationId, path, terminusId, ends, layer)
            }
        }
    }
    const exits = new Set<number>()
    const openExit = (vertices: readonly number[]) => {
        const fresh = vertices.filter((vertex) => !exits.has(vertex))
        if (!fresh.length) return false
        const entry = graph.vertex()
        const exit = graph.vertex()
        graph.match(entry, exit)
        graph.join(start, entry)
        for (const vertex of fresh) {
            graph.join(exit, vertex)
            exits.add(vertex)
        }
        return true
    }
    for (const { locationId, nodeId } of origins) {
        const origin = stop(locationId, nodeId, 'standard')
        graph.join(start, origin.pair[0])
        openExit([...(origin.node.kind === 'offboard' ? origin.track : []), ...origin.departures])
    }

    let outer = graph.outerFrom(start)
    // A stop a route reaches by other track and may pass can be left along its terminus track.
    for (;;) {
        let opened = false
        for (const { pair, passable, departures } of stops.values())
            if (passable && (outer[pair[0]] || outer[pair[1]]) && openExit(departures))
                opened = true
        if (!opened) break
        outer = graph.outerFrom(start)
    }

    const reachedNodes = new Set<string>()
    for (const { center, node, pair, passable, arrival: ended } of stops.values()) {
        if (!outer[pair[0]] && !outer[pair[1]] && !(ended && outer[ended[1]])) continue
        const key = `${center.locationId} ${center.nodeId}`
        if (reachedNodes.has(key)) continue
        reachedNodes.add(key)
        visitor.reached?.(center.locationId, { kind: 'node', nodeId: center.nodeId })
        if (!passable && node.kind !== 'offboard') visitor.blocked?.(center.locationId, node)
    }
    for (const { locationId, pathId, ends } of paths) {
        if (outer[ends[0]] || outer[ends[1]]) visitor.used?.(locationId, pathId)
    }
    for (const { locationId, endpoint, gauge, beyond, into } of sides) {
        if (!outer[beyond]) continue
        visitor.reached?.(locationId, endpoint)
        if (!into) continue
        visitor.entered?.(into.locationId, into.endpoint, gauge)
        if (into.tracked) visitor.reached?.(into.locationId, into.endpoint)
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
