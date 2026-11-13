import { assert, assertExists } from '@tabletop/common'
import {
    RouteNetwork,
    cityIsBlocked,
    usesStationAt,
    routePathResources,
    stopValue,
    RouteEvaluation,
    fleetPaymentKey,
    fleetRoot,
    type RevenueCenter,
    type RoutePath,
    type RouteRules,
    type TrainRoute,
    stretchWeight,
    type TrainDistance,
    type TrainRunningState,
    type TileEndpoint
} from '@tabletop/18xx'
import type { SolverArc, SolverProblem, SolverSolution } from './solverProtocol.js'

export class EncodedRoutes {
    readonly problem: SolverProblem
    private readonly centers: RevenueCenter[]
    private readonly paths: RoutePath[] = []
    private readonly locationIds: string[]
    private readonly hexIds: Map<string, number>
    private readonly resourceKeys: string[]
    private readonly junctionKeys: string[]
    private readonly groupKeys: string[]
    private readonly unlimitedTrainIds: Set<string>
    private readonly requiredEnds: readonly RevenueCenter[] | undefined

    constructor(
        state: TrainRunningState,
        rules: RouteRules,
        companyId: string,
        network: RouteNetwork,
        budget: { timeLimitMs: number; memoryBudgetBytes: number }
    ) {
        this.requiredEnds = rules.requiredRouteEnds?.(state, companyId)
        this.centers = network.centers()
        const centerIds = new Map(
            this.centers.map((center, index) => [this.centerKey(center), index])
        )
        const resources = new Map<string, number>()
        const junctions = new Map<string, number>()
        const locations = rules.map.definition.locations
        this.locationIds = locations.map((location) => location.id)
        this.hexIds = new Map(locations.map((location, index) => [location.id, index]))
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
                const hex = this.hexOf(locationId)
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
                    crossings: arrival.kind === 'edge' ? 1 : 0,
                    gauge: path.gauge ?? 'standard'
                })
            }
        }
        const nodes = this.centers.map(({ locationId, nodeId }) => {
            const node = network.face(locationId).nodes.find((node) => node.id === nodeId)
            assertExists(node, 'Route requires an existing node')
            assert(node.kind !== 'junction', 'A route stop is a revenue center')
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
                town: node.kind === 'town',
                hex: this.hexOf(center.locationId),
                token: usesStationAt(state, companyId, center.locationId, center.nodeId),
                blocked:
                    node.kind === 'offboard' ||
                    cityIsBlocked(state, companyId, center.locationId, node),
                endpoint: rules.fleet?.routeShape?.endKinds.includes(node.kind) ?? true,
                allowed: rules.stopAllowed?.(state, companyId, center) ?? true,
                groups: [
                    ...(group === undefined ? [] : [this.indexFor(groupIds, group)]),
                    ...hexGroup
                ]
            }
        })
        const runnable = new RouteEvaluation(state, rules).runnableTrains(companyId)
        this.unlimitedTrainIds = new Set(
            runnable
                .filter(
                    (train) =>
                        rules.depot.trainDefinition(train.definitionId).distance.maximum ===
                        'unlimited'
                )
                .map((train) => train.id)
        )
        const trains = runnable.map((train) => {
            const definition = rules.depot.trainDefinition(train.definitionId)
            const countsCrossings = definition.distance.measure === 'hex-edges'
            const { measure, maximum, extraTowns = 0 } = definition.distance
            const unlimitedDistance = (costs: readonly number[]) =>
                nodes.length +
                arcs.reduce((sum, arc) => sum + arc.crossings, 0) * Math.max(1, ...costs)
            // A train kept off narrow gauge finds each narrow hex side past its whole reach.
            const crossingCosts = this.crossingCosts(definition.distance, (costs) =>
                maximum === 'unlimited' ? unlimitedDistance(costs) + 1 : maximum + extraTowns + 1
            )
            const visitCosts = nodes.map((node) =>
                countsCrossings ||
                (definition.distance.measure === 'cities-and-offboards' && node.kind === 'town')
                    ? 0
                    : 1
            )
            const policy = rules.revenuePolicy?.(definition, state, companyId)
            const fleet = rules.fleet?.trains?.[definition.id] ?? {}
            assert(
                !extraTowns || measure === 'revenue-centers',
                'Only revenue-center trains may visit extra towns'
            )
            const values = nodes.map((node, index) => {
                const center = this.centers[index]
                assertExists(center, 'Revenue center requires a location')
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
                ),
                ends_only: false
            }))
            return {
                id: train.id,
                allowed_stops: this.centers.map(
                    (center) => rules.stopAllowed?.(state, companyId, center, definition) ?? true
                ),
                ...(rules.fleet
                    ? {
                          fleet: {
                              paying: nodes.map(
                                  (node) => fleet.payingKinds?.includes(node.kind) ?? true
                              ),
                              limited: nodes.map(
                                  (node) =>
                                      fleet.payingStopLimit?.kinds.includes(node.kind) ?? false
                              ),
                              paying_limit: fleet.payingStopLimit?.count ?? null,
                              hex_subsidy: fleet.hexSubsidy ?? 0,
                              freight: fleet.freight ?? null
                          }
                      }
                    : {}),
                distance:
                    maximum === 'unlimited'
                        ? visitCosts.reduce<number>((sum, cost) => sum + cost, 0) +
                          arcs.reduce((sum, arc) => sum + arc.crossings, 0) *
                              Math.max(
                                  1,
                                  ...(definition.distance.standardGaugeOnly
                                      ? [crossingCosts[0], crossingCosts[2]]
                                      : crossingCosts)
                              )
                        : maximum + extraTowns,
                major_limit: extraTowns && maximum !== 'unlimited' ? maximum : null,
                crossing_costs: crossingCosts,
                visit_costs: visitCosts,
                requires_city: rules.requiresCity(definition),
                paying_stop_limit: policy?.payingStopLimit ?? null,
                require_paying_token: policy?.requirePayingStation ?? false,
                bonuses_along_route: policy?.bonusesAlongRoute ?? false,
                connection_bonuses: [
                    ...(policy?.connectionBonuses ?? []).map(({ from, to, destinationAtEnd }) => ({
                        from: this.centers.map((center) => from[center.locationId] ?? null),
                        to: this.centers.map((center) => to[center.locationId] ?? null),
                        ends_only: destinationAtEnd ?? false
                    })),
                    ...bestStopBonuses
                ],
                interconnections: (policy?.interconnections ?? []).map(({ from, to, amount }) => ({
                    from: from.map((locationId) => this.hexOf(locationId)),
                    to: to.map((locationId) => this.hexOf(locationId)),
                    amount
                })),
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
        this.resourceKeys = [...resources.keys()]
        this.junctionKeys = [...junctions.keys()]
        this.groupKeys = [...groupIds.keys()]
        this.problem = {
            version: 8,
            stops,
            arcs,
            trains,
            resource_count: resources.size,
            junction_count: junctions.size,
            group_count: groupIds.size,
            hex_bonuses: locations.map((location) => rules.hexBonus?.(state, location.id) ?? 0),
            longest_route_bonus_per_stop: rules.longestRouteBonusPerStop?.(state, companyId) ?? 0,
            minimum_cities_and_towns: rules.minimumCitiesAndTowns ?? 0,
            budget_ms: budget.timeLimitMs,
            memory_budget_bytes: budget.memoryBudgetBytes
        }
        if (rules.fleet) {
            const fleet = rules.fleet
            const payments = new Map<string, number>()
            const root = fleetRoot(state, companyId, fleet)
            this.problem.fleet = {
                shared_track: fleet.sharedTrack ?? false,
                pay_once: fleet.payOnce !== undefined,
                payment_groups: this.centers.map((center) =>
                    this.indexFor(payments, fleetPaymentKey(fleet, center))
                ),
                connectivity: fleet.connectivity
                    ? {
                          root: root ? (centerIds.get(this.centerKey(root)) ?? null) : null,
                          stops: nodes.map((node) => node.kind === fleet.connectivity?.at)
                      }
                    : null,
                minimum_cities: fleet.routeShape?.minimumCities ?? 0,
                coordinates: locations.map((location) => location.coordinates),
                bonus_per_hex: fleet.freightChains?.bonusPerHex ?? 0,
                end_rates: this.centers.map((center) =>
                    Math.max(
                        fleet.freightChains?.bonusPerHex ?? 0,
                        ...(fleet.freightChains?.endRates ?? [])
                            .filter((rate) =>
                                rate.stops.some(
                                    (stop) => this.centerKey(stop) === this.centerKey(center)
                                )
                            )
                            .map((rate) => rate.bonusPerHex)
                    )
                ),
                offboard_distance: fleet.freightChains?.offboardDistance === 'adjacent-hex'
            }
        }
    }

    decode(solution: SolverSolution): TrainRoute[] {
        return this.decodeRoutes(this.problem.trains, solution)
    }

    private decodeRoutes(trains: SolverProblem['trains'], solution: SolverSolution): TrainRoute[] {
        return solution.routes.map((route) => {
            const train = trains[route.train]
            const connection = route.connections[0]
            assertExists(train, 'Solver returned an unknown train')
            assertExists(connection, 'Solver returned an empty route')
            const start = this.centers[connection.from]
            assertExists(start, 'Solver returned an unknown start')
            return {
                trainId: train.id,
                start: { ...start },
                paths: route.connections.flatMap((connection) =>
                    this.decodePaths(connection.paths)
                ),
                ...(route.extension.length ? { extension: this.decodePaths(route.extension) } : {})
            }
        })
    }

    beside(
        trainId: string,
        usedResources: readonly string[]
    ): { problem: SolverProblem; decode(solution: SolverSolution): TrainRoute[] } {
        const used = new Set(usedResources)
        const banned = new Set(
            this.problem.arcs.flatMap((arc, id) =>
                arc.resources.some((resource) => used.has(this.resourceKeys[resource])) ? [id] : []
            )
        )
        const trains = this.problem.trains.filter((train) => train.id !== trainId)
        return {
            problem: {
                ...this.problem,
                trains,
                arcs: this.problem.arcs.map((arc, id) =>
                    banned.has(id)
                        ? { ...arc, from: null, to: null, next: [] }
                        : { ...arc, next: arc.next.filter((next) => !banned.has(next)) }
                )
            },
            decode: (solution) => this.decodeRoutes(trains, solution)
        }
    }

    // Indices shift whenever a tile is laid anywhere, so the key names stops and paths instead.
    networkKey(): string {
        const { stops, arcs, trains } = this.problem
        const departures = new Map<number, number[]>()
        for (const [id, arc] of arcs.entries())
            if (arc.from !== null)
                departures.set(arc.from, [...(departures.get(arc.from) ?? []), id])
        const extendsPastBlocked = trains.some((train) => train.interconnections.length > 0)
        const reachedStops = new Set<number>()
        const reachedArcs = new Set<number>()
        const pending: ({ stop: number } | { arc: number })[] = stops.flatMap((stop, index) =>
            stop.token ? [{ stop: index }] : []
        )
        for (let next = pending.pop(); next; next = pending.pop()) {
            if ('stop' in next) {
                if (reachedStops.has(next.stop)) continue
                reachedStops.add(next.stop)
                const stop = stops[next.stop]
                if (!stop.allowed || (stop.blocked && !stop.token && !extendsPastBlocked)) continue
                for (const arc of departures.get(next.stop) ?? []) pending.push({ arc })
                continue
            }
            if (reachedArcs.has(next.arc)) continue
            reachedArcs.add(next.arc)
            const arc = arcs[next.arc]
            if (arc.to !== null) pending.push({ stop: arc.to })
            else for (const following of arc.next) pending.push({ arc: following })
        }
        const stopName = (index: number) => this.centerKey(this.centers[index])
        const arcName = (index: number) => JSON.stringify([this.paths[arcs[index].path], index % 2])
        const stopIndices = [...reachedStops].sort((a, b) => stopName(a).localeCompare(stopName(b)))
        const arcIndices = [...reachedArcs].sort((a, b) => arcName(a).localeCompare(arcName(b)))
        const hexes = new Set(arcIndices.map((index) => arcs[index].hex))
        return JSON.stringify({
            version: this.problem.version,
            ...(this.problem.fleet ? { fleet: this.problem.fleet } : {}),
            required_ends: this.requiredEnds?.map((end) => this.centerKey(end)),
            stops: stopIndices.map((index) => {
                const { groups, hex, ...flags } = stops[index]
                return [stopName(index), flags, groups.map((group) => this.groupKeys[group])]
            }),
            arcs: arcIndices.map((index) => {
                const { from, to, next, resources, junctions, path, hex, ...flags } = arcs[index]
                return [
                    arcName(index),
                    from === null ? null : stopName(from),
                    to === null ? null : stopName(to),
                    next.map(arcName).sort(),
                    resources.map((resource) => this.resourceKeys[resource]).sort(),
                    junctions.map((junction) => this.junctionKeys[junction]),
                    flags
                ]
            }),
            trains: trains.map((train) => {
                const perStop = (values: readonly (number | null)[]) =>
                    stopIndices.map((index) => values[index])
                const locations = (hexes: readonly number[]) =>
                    hexes.map((hex) => this.locationIds[hex])
                return {
                    id: train.id,
                    distance: this.unlimitedTrainIds.has(train.id) ? 'unlimited' : train.distance,
                    crossing_costs: train.crossing_costs,
                    requires_city: train.requires_city,
                    allowed_stops: perStop(train.allowed_stops.map(Number)),
                    ...(train.fleet ? { fleet: train.fleet } : {}),
                    major_limit: train.major_limit,
                    paying_stop_limit: train.paying_stop_limit,
                    require_paying_token: train.require_paying_token,
                    bonuses_along_route: train.bonuses_along_route,
                    visit_costs: perStop(train.visit_costs),
                    revenues: perStop(train.revenues),
                    first_bonus: perStop(train.first_bonus),
                    connection_bonuses: train.connection_bonuses.map(({ from, to, ends_only }) => ({
                        from: perStop(from),
                        to: perStop(to),
                        ends_only
                    })),
                    interconnections: train.interconnections.map(({ from, to, amount }) => ({
                        from: locations(from),
                        to: locations(to),
                        amount
                    }))
                }
            }),
            hex_bonuses: [...hexes]
                .sort((a, b) => a - b)
                .map((hex) => [this.locationIds[hex], this.problem.hex_bonuses[hex]]),
            longest_route_bonus_per_stop: this.problem.longest_route_bonus_per_stop,
            minimum_cities_and_towns: this.problem.minimum_cities_and_towns
        })
    }

    /** What each hex side of standard, narrow and dual track costs; `beyondReach` given the others. */
    private crossingCosts(
        distance: TrainDistance,
        beyondReach: (costs: readonly number[]) => number
    ): [number, number, number] {
        if (distance.measure !== 'hex-edges') return [0, 0, 0]
        const standard = stretchWeight(distance, 'standard')
        const either = stretchWeight(distance, 'either')
        return [
            standard,
            distance.standardGaugeOnly
                ? beyondReach([standard, either])
                : stretchWeight(distance, 'narrow'),
            either
        ]
    }

    private hexOf(locationId: string): number {
        const hex = this.hexIds.get(locationId)
        assertExists(hex, 'Route rules name an unknown map location')
        return hex
    }
    private decodePaths(ids: readonly number[]): RoutePath[] {
        return ids.map((id) => {
            const path = this.paths[id]
            assertExists(path, 'Solver returned an unknown path')
            return { ...path }
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
