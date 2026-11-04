import { reachRoutes } from '../construction/routeReach.js'
import { cityIsBlocked, sameCenter, type StationState } from '../map/station.js'
import type { RevenueCenter, RoutePath } from '../routes/route.js'
import type { RouteNetwork } from '../routes/routeNetwork.js'
import type { TileEndpoint, TileNode } from '../tiles/tile.js'

const endpointKey = (locationId: string, endpoint: TileEndpoint) =>
    endpoint.kind === 'edge'
        ? `${locationId} edge ${endpoint.edge}`
        : `${locationId} node ${endpoint.nodeId}`

type Link = { to: string; stops: 0 | 1 }

/**
 * The fewest stops each stop lies from a target along track, ignoring which way a route may turn:
 * a lower bound that prunes the exact search. Only passable stops relay the count.
 */
function stopsToTarget(
    network: RouteNetwork,
    target: RevenueCenter,
    passable: (locationId: string, node: TileNode) => boolean
): Map<string, number> {
    const links = new Map<string, Link[]>()
    const closed = new Set<string>()
    const link = (from: string, to: string, stops: 0 | 1) => {
        links.set(from, [...(links.get(from) ?? []), { to, stops }])
    }
    const mapState = network.mapState
    for (const { id: locationId } of mapState.map.definition.locations) {
        const face = network.face(locationId)
        const stopNode = (endpoint: TileEndpoint) =>
            endpoint.kind === 'node'
                ? face.nodes.find((node) => node.id === endpoint.nodeId)
                : undefined
        for (const path of face.paths) {
            const [a, b] = path.endpoints.map((end) => endpointKey(locationId, end))
            for (const [from, to, end] of [
                [b, a, path.endpoints[0]],
                [a, b, path.endpoints[1]]
            ] as const) {
                const node = stopNode(end)
                const stop = !!node && node.kind !== 'junction'
                link(from, to, stop ? 1 : 0)
                // A blocked stop can start or end a route but relays nothing onward.
                if (stop && !passable(locationId, node)) closed.add(to)
            }
        }
        for (const connection of mapState.connections(locationId))
            link(
                endpointKey(locationId, { kind: 'edge', edge: connection.edge }),
                endpointKey(connection.neighborLocationId, {
                    kind: 'edge',
                    edge: connection.neighborEdge
                }),
                0
            )
    }
    const distance = new Map<string, number>()
    const start = endpointKey(target.locationId, { kind: 'node', nodeId: target.nodeId })
    distance.set(start, 0)
    const queue = [start]
    for (let index = 0; index < queue.length; index++) {
        const key = queue[index]
        if (index > 0 && closed.has(key)) continue
        const here = distance.get(key) ?? 0
        for (const { to, stops } of links.get(key) ?? []) {
            const next = here + stops
            if ((distance.get(to) ?? Infinity) <= next) continue
            distance.set(to, next)
            if (stops) queue.push(to)
            else queue.splice(index + 1, 0, to)
        }
    }
    return distance
}

export function routesBetween(
    network: RouteNetwork,
    state: StationState,
    companyId: string,
    from: RevenueCenter,
    to: RevenueCenter,
    maximumStops: number,
    {
        stopAllowed = () => true,
        limit = Infinity,
        maximumSteps = RouteSearchSteps
    }: RouteSearchOptions = {}
): { routes: RoutePath[][]; exhausted: boolean } {
    const routes: RoutePath[][] = []
    if (sameCenter(from, to)) return { routes, exhausted: true }
    const passable = (locationId: string, node: TileNode) =>
        node.kind !== 'offboard' &&
        !cityIsBlocked(state, companyId, locationId, node) &&
        stopAllowed({ locationId, nodeId: node.id })
    const remaining = stopsToTarget(network, to, passable)
    const key = (center: RevenueCenter) =>
        endpointKey(center.locationId, { kind: 'node', nodeId: center.nodeId })
    if (1 + (remaining.get(key(from)) ?? Infinity) > maximumStops)
        return { routes, exhausted: true }

    let exhausted = true
    let steps = 0
    const search = (paths: readonly RoutePath[]): void => {
        for (const extension of network.extensions(from, paths)) {
            if (routes.length >= limit || ++steps > maximumSteps) {
                exhausted = false
                return
            }
            const next = [...paths, extension]
            const trace = network.trace(from, next).trace
            if (!trace) continue
            const { end, visits } = trace
            if (end.endpoint.kind === 'node') {
                const nodeId = end.endpoint.nodeId
                const center = { locationId: end.locationId, nodeId }
                const stop = visits.at(-1)
                if (stop && sameCenter(stop, center)) {
                    if (sameCenter(center, to)) {
                        if (visits.length <= maximumStops) routes.push(next)
                        continue
                    }
                    if (
                        visits.slice(0, -1).some((visit) => sameCenter(visit, center)) ||
                        !passable(center.locationId, stop.node) ||
                        visits.length + (remaining.get(key(center)) ?? Infinity) > maximumStops
                    )
                        continue
                }
            }
            search(next)
        }
    }
    search([])
    return { routes, exhausted }
}

type RouteSearchOptions = {
    stopAllowed?: (center: RevenueCenter) => boolean
    limit?: number
    maximumSteps?: number
}

// Finding the shortest legal route has no search as direct as `reachRoutes`, so a game's own backend
// is protected by a count, which replays alike. A company whose route lies beyond it waits a turn.
export const RouteSearchSteps = 10_000

export function connectedWithin(
    network: RouteNetwork,
    state: StationState,
    companyId: string,
    from: RevenueCenter,
    to: RevenueCenter,
    maximumStops: number,
    stopAllowed: (center: RevenueCenter) => boolean = () => true,
    maximumSteps?: number
): boolean {
    let reachable = false
    reachRoutes(
        network.mapState.map,
        (locationId) => network.face(locationId),
        [from],
        (locationId, node) =>
            cityIsBlocked(state, companyId, locationId, node) ||
            !stopAllowed({ locationId, nodeId: node.id }),
        {
            reached(locationId, endpoint) {
                if (
                    endpoint.kind === 'node' &&
                    sameCenter({ locationId, nodeId: endpoint.nodeId }, to)
                )
                    reachable = true
            }
        }
    )
    if (!reachable || maximumStops === Infinity) return reachable
    return (
        routesBetween(network, state, companyId, from, to, maximumStops, {
            stopAllowed,
            limit: 1,
            maximumSteps
        }).routes.length > 0
    )
}
