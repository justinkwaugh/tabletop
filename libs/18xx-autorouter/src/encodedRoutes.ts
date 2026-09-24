import { assertExists } from '@tabletop/common'
import {
    RouteNetwork,
    cityIsBlocked,
    routePathResources,
    routeRevenue,
    trainsOwnedBy,
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
                this.resourceId(resources, key)
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
        const stops = this.centers.map((center, index) => {
            const node = nodes[index]
            assertExists(node, 'Revenue center requires a node')
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
                allowed: true,
                groups: []
            }
        })
        const trains = trainsOwnedBy(state, { kind: 'company', companyId }).map((train) => {
            const definition = rules.depot.trainDefinition(train.definitionId)
            const countsCrossings = definition.distance.measure === 'hex-edges'
            const visitCosts = nodes.map((node) =>
                countsCrossings ||
                (definition.distance.measure === 'cities-and-offboards' && node.kind === 'town')
                    ? 0
                    : 1
            )
            const stages = rules.revenueStage(state, definition)
            return {
                id: train.id,
                distance:
                    definition.distance.maximum === 'unlimited'
                        ? visitCosts.reduce<number>((sum, cost) => sum + cost, 0) +
                          arcs.reduce((sum, arc) => sum + arc.crossings, 0)
                        : definition.distance.maximum,
                counts_crossings: countsCrossings,
                visit_costs: visitCosts,
                requires_city: rules.requiresCity(definition),
                revenues: nodes.map((node) => {
                    if (node.kind === 'junction')
                        throw new Error('A junction is not a revenue center')
                    return routeRevenue(node.revenue, stages)
                }),
                first_bonus: nodes.map(() => 0)
            }
        })
        this.problem = {
            version: 2,
            stops,
            arcs,
            trains,
            resource_count: resources.size,
            group_count: 0,
            hex_bonuses: locations.map(() => 0),
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

    private resourceId(resources: Map<string, number>, key: string): number {
        const existing = resources.get(key)
        if (existing !== undefined) return existing
        const id = resources.size
        resources.set(key, id)
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
