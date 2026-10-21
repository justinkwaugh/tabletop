import { assert, assertExists } from '@tabletop/common'
import {
    RouteNetwork,
    cityIsBlocked,
    routePathResources,
    stopValue,
    RouteEvaluation,
    type RevenueCenter,
    type RoutePath,
    type RouteRules,
    type TrainRoute,
    type TrainRunningState,
    type TileEndpoint
} from '@tabletop/18xx'
import type { SolverArc, SolverProblem, SolverSolution } from './solverProtocol.js'

export class EncodedRoutes {
    readonly problem: SolverProblem
    private readonly centers: RevenueCenter[]
    private readonly paths: RoutePath[] = []

    constructor(
        state: TrainRunningState,
        rules: RouteRules,
        companyId: string,
        network: RouteNetwork,
        timeLimitMs: number
    ) {
        this.centers = network.centers()
        const centerIds = new Map(
            this.centers.map((center, index) => [this.centerKey(center), index])
        )
        const resources = new Map<string, number>()
        const junctions = new Map<string, number>()
        const locations = rules.map.definition.locations
        const hexIds = new Map(locations.map((location, index) => [location.id, index]))
        const tracks = locations.flatMap(({ id: locationId }) =>
            network.face(locationId).paths.map((path) => ({ locationId, path }))
        )
        const outgoing = new Map<string, number[]>()
        for (const [id, { locationId, path }] of tracks.entries()) {
            this.paths.push({ locationId, pathId: path.id })
            for (const [direction, endpoint] of path.endpoints.entries()) {
                const key = this.endpointKey(locationId, endpoint)
                const ids = outgoing.get(key) ?? []
                ids.push(2 * id + direction)
                outgoing.set(key, ids)
            }
        }
        const arcs: SolverArc[] = []
        for (const [id, { locationId, path }] of tracks.entries()) {
            const pathResources = routePathResources(locationId, path).map((key) =>
                this.indexFor(resources, key)
            )
            for (const [direction, departure] of path.endpoints.entries()) {
                const arrival = path.endpoints[1 - direction]
                assertExists(arrival, 'Track requires two endpoints')
                let next: number[] = []
                if (arrival.kind === 'edge') {
                    const connection = network.mapState
                        .connections(locationId)
                        .find((c) => c.edge === arrival.edge)
                    if (connection)
                        next =
                            outgoing.get(
                                this.endpointKey(connection.neighborLocationId, {
                                    kind: 'edge',
                                    edge: connection.neighborEdge
                                })
                            ) ?? []
                } else if (
                    network
                        .face(locationId)
                        .nodes.some(
                            (node) => node.id === arrival.nodeId && node.kind === 'junction'
                        )
                ) {
                    next = (outgoing.get(this.endpointKey(locationId, arrival)) ?? []).filter(
                        (arc) => Math.floor(arc / 2) !== id
                    )
                }
                const hex = hexIds.get(locationId)
                assertExists(hex, 'Track requires a map location')
                arcs.push({
                    from:
                        departure.kind === 'node'
                            ? (centerIds.get(
                                  this.centerKey({ locationId, nodeId: departure.nodeId })
                              ) ?? null)
                            : null,
                    to:
                        arrival.kind === 'node'
                            ? (centerIds.get(
                                  this.centerKey({ locationId, nodeId: arrival.nodeId })
                              ) ?? null)
                            : null,
                    next,
                    resources: pathResources,
                    junctions: path.endpoints.flatMap((endpoint) =>
                        endpoint.kind === 'node' &&
                        network
                            .face(locationId)
                            .nodes.some(
                                (node) => node.id === endpoint.nodeId && node.kind === 'junction'
                            )
                            ? [this.indexFor(junctions, this.endpointKey(locationId, endpoint))]
                            : []
                    ),
                    path: id,
                    hex,
                    terminal: false,
                    crossings: arrival.kind === 'edge' ? 1 : 0
                })
            }
        }
        const nodes = this.centers.map(({ locationId, nodeId }) => {
            const node = network.face(locationId).nodes.find((node) => node.id === nodeId)
            assertExists(node, 'Route requires an existing node')
            return node
        })
        const groupIds = new Map<string, number>()
        const stops = this.centers.map((center, index) => {
            const node = nodes[index]
            assertExists(node, 'Revenue center requires a node')
            const group = rules.map.location(center.locationId).stopGroup
            const hexGroup =
                rules.oneStopPerHex &&
                this.centers.filter((other) => other.locationId === center.locationId).length > 1
                    ? [this.indexFor(groupIds, `hex:${center.locationId}`)]
                    : []
            return {
                city: node.kind === 'city',
                token: state.stations.some(
                    (station) =>
                        station.status === 'placed' &&
                        station.companyId === companyId &&
                        station.position.locationId === center.locationId &&
                        station.position.nodeId === center.nodeId
                ),
                blocked:
                    node.kind === 'offboard' ||
                    cityIsBlocked(state, companyId, center.locationId, node),
                endpoint: true,
                allowed: rules.stopAllowed?.(state, companyId, center) ?? true,
                groups: [
                    ...(group === undefined ? [] : [this.indexFor(groupIds, group)]),
                    ...hexGroup
                ]
            }
        })
        const trains = new RouteEvaluation(state, rules).runnableTrains(companyId).map((train) => {
            const definition = rules.depot.trainDefinition(train.definitionId)
            const countsCrossings = definition.distance.measure === 'hex-edges'
            const { maximum, extraTowns = 0 } = definition.distance
            const weighted =
                extraTowns && maximum !== 'unlimited'
                    ? extraTownWeights(maximum, extraTowns)
                    : undefined
            const visitCosts = nodes.map((node) => {
                if (
                    countsCrossings ||
                    (definition.distance.measure === 'cities-and-offboards' && node.kind === 'town')
                )
                    return 0
                if (!weighted) return 1
                return node.kind === 'town' ? weighted.town : weighted.other
            })
            const policy = rules.revenuePolicy?.(definition)
            const values = nodes.map((node, index) => {
                const center = this.centers[index]
                assertExists(center, 'Revenue center requires a location')
                if (node.kind === 'junction') throw new Error('A junction is not a revenue center')
                return stopValue(state, rules, companyId, center, node, definition)
            })
            const bestStopBonuses = (
                rules.bestStopBonuses?.(state, companyId, definition) ?? []
            ).map(({ locationIds, ignoredLocationIds = [] }) => ({
                from: this.centers.map((center) =>
                    locationIds.includes(center.locationId) ? 0 : null
                ),
                to: this.centers.map((center, index) =>
                    locationIds.includes(center.locationId) ||
                    ignoredLocationIds.includes(center.locationId)
                        ? null
                        : (values[index] ?? null)
                )
            }))
            return {
                id: train.id,
                distance:
                    maximum === 'unlimited'
                        ? visitCosts.reduce<number>((sum, cost) => sum + cost, 0) +
                          arcs.reduce((sum, arc) => sum + arc.crossings, 0)
                        : (weighted?.limit ?? maximum),
                counts_crossings: countsCrossings,
                visit_costs: visitCosts,
                requires_city: rules.requiresCity(definition),
                paying_stop_limit: policy?.payingStopLimit ?? null,
                require_paying_token: policy?.requirePayingStation ?? false,
                connection_bonuses: [
                    ...(policy?.connectionBonuses ?? []).map(({ from, to }) => ({
                        from: this.centers.map((center) => from[center.locationId] ?? null),
                        to: this.centers.map((center) => to[center.locationId] ?? null)
                    })),
                    ...bestStopBonuses
                ],
                revenues: nodes.map((_, index) => {
                    const center = this.centers[index]
                    assertExists(center, 'Revenue center requires a location')
                    return (
                        (values[index] ?? 0) +
                        (rules.stopBonus?.(state, definition, companyId, center) ?? 0)
                    )
                }),
                first_bonus: nodes.map(() => 0)
            }
        })
        this.problem = {
            version: 4,
            stops,
            arcs,
            trains,
            resource_count: resources.size,
            junction_count: junctions.size,
            group_count: groupIds.size,
            hex_bonuses: locations.map((location) => rules.hexBonus?.(state, location.id) ?? 0),
            longest_route_bonus_per_stop: rules.longestRouteBonusPerStop?.(state, companyId) ?? 0,
            budget_ms: timeLimitMs
        }
    }

    decode(solution: SolverSolution): TrainRoute[] {
        return solution.routes.map((route) => {
            const train = this.problem.trains[route.train]
            const connection = route.connections[0]
            assertExists(train, 'Solver returned an unknown train')
            assertExists(connection, 'Solver returned an empty route')
            const start = this.centers[connection.from]
            assertExists(start, 'Solver returned an unknown start')
            return {
                trainId: train.id,
                start: { ...start },
                paths: route.connections.flatMap((connection) =>
                    connection.paths.map((id) => {
                        const path = this.paths[id]
                        assertExists(path, 'Solver returned an unknown path')
                        return { ...path }
                    })
                )
            }
        })
    }

    private indexFor(indices: Map<string, number>, key: string): number {
        const existing = indices.get(key)
        if (existing !== undefined) return existing
        const id = indices.size
        indices.set(key, id)
        return id
    }
    private centerKey(center: RevenueCenter): string {
        return this.endpointKey(center.locationId, { kind: 'node', nodeId: center.nodeId })
    }
    private endpointKey(locationId: string, endpoint: TileEndpoint): string {
        return JSON.stringify([
            locationId,
            endpoint.kind,
            endpoint.kind === 'edge' ? endpoint.edge : endpoint.nodeId
        ])
    }
}

/**
 * Stop costs and a limit that hold a train to its maximum stops plus one extra town in one
 * distance, as the solver counts only one: no more than the maximum non-town stops, and no more
 * than one more stop in all.
 */
export function extraTownWeights(
    maximum: number,
    extraTowns: number
): { town: number; other: number; limit: number } {
    assert(extraTowns === 1, 'The autorouter encodes at most one extra town')
    const town = maximum + 1
    const other = town + 1
    return { town, other, limit: other * maximum + town }
}
