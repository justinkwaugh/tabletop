import { trainsOwnedBy } from '../trains/train.js'
import { hasStationRoute } from '../trains/trainRequirement.js'
import { routeRevenue } from './routeRevenue.js'
import { controllingOwner, getCompany, sameOwner } from '../finance/finance.js'
import { RailwayMapState } from '../map/mapState.js'
import { cityIsBlocked } from '../map/station.js'
import type { RailwayMap } from '../map/map.js'
import type { TileSet } from '../tiles/inventory.js'
import type { TrainDefinition } from '../trains/train.js'
import type { TrainDepot } from '../trains/trainDepot.js'
import { RouteNetwork, type RouteTrace, type RouteVisit } from './routeNetwork.js'
import type { OperatingResult, RouteResult, TrainRunningState, TrainRoute } from './route.js'
export interface RouteRules {
    map: RailwayMap
    tileSet: TileSet
    depot: TrainDepot
    revenueStage(state: TrainRunningState, train: TrainDefinition): readonly string[]
    requiresCity(train: TrainDefinition): boolean
}
export type RouteEvaluationResult =
    | { result: RouteResult; reason?: never }
    | { result?: never; reason: string }
export type OperatingEvaluation =
    | { result: OperatingResult; reason?: never }
    | { result?: never; reason: string }
export class RouteEvaluation {
    readonly network: RouteNetwork
    constructor(
        private readonly state: TrainRunningState,
        readonly rules: RouteRules
    ) {
        this.network = new RouteNetwork(
            new RailwayMapState(rules.map, rules.tileSet, state.tileInventory)
        )
    }
    cannotRun(companyId: string): boolean {
        return !trainsOwnedBy(this.state, { kind: 'company', companyId }).length ||
            !hasStationRoute(this.network.mapState, this.state, companyId)
    }
    canAct(playerId: string, companyId: string): boolean {
        return (
            this.state.routeStep?.companyId === companyId &&
            !this.state.routeStep.result &&
            !getCompany(this.state, companyId).closed &&
            controllingOwner(this.state, companyId)?.playerId === playerId
        )
    }
    evaluateRoute(companyId: string, route: TrainRoute, complete = true): RouteEvaluationResult {
        const train = this.state.trainInventory.trains.find((train) => train.id === route.trainId)
        if (
            !train ||
            train.status !== 'owned' ||
            !sameOwner(train.owner, { kind: 'company', companyId })
        )
            return { reason: 'The company does not own this train.' }
        const definition = this.rules.depot.trainDefinition(train.definitionId)
        const traced = this.network.trace(route.start, route.paths)
        if (!traced.trace) return { reason: traced.reason }
        const trace = traced.trace
        const seen = new Set<string>()
        for (const [index, visit] of trace.visits.entries()) {
            const key = JSON.stringify([visit.locationId, visit.nodeId])
            if (seen.has(key)) return { reason: 'A train cannot revisit a revenue center.' }
            seen.add(key)
            const isEnd =
                trace.end.endpoint.kind === 'node' &&
                trace.end.locationId === visit.locationId &&
                trace.end.endpoint.nodeId === visit.nodeId
            if (
                index > 0 &&
                !isEnd &&
                (visit.node.kind === 'offboard' ||
                    cityIsBlocked(this.state, companyId, visit.locationId, visit.node))
            )
                return { reason: 'The route cannot pass through a blocked city or offboard.' }
        }
        const distance = this.distance(definition, trace)
        if (definition.distance.maximum !== 'unlimited' && distance > definition.distance.maximum)
            return { reason: `The route exceeds the ${definition.name} train’s distance limit.` }
        if (complete) {
            if (
                !route.paths.length ||
                trace.end.endpoint.kind !== 'node' ||
                !trace.visits.some(
                    (visit) =>
                        visit.locationId === trace.end.locationId &&
                        trace.end.endpoint.kind === 'node' &&
                        visit.nodeId === trace.end.endpoint.nodeId
                )
            )
                return { reason: 'End the route at a revenue center.' }
            if (trace.visits.length < 2)
                return { reason: 'A route needs at least two revenue centers.' }
            if (
                this.rules.requiresCity(definition) &&
                !trace.visits.some((visit) => visit.node.kind === 'city')
            )
                return { reason: 'This train must visit a city.' }
            if (
                !trace.visits.some((visit) =>
                    this.state.stations.some(
                        (station) =>
                            station.status === 'placed' &&
                            station.companyId === companyId &&
                            station.position.locationId === visit.locationId &&
                            station.position.nodeId === visit.nodeId
                    )
                )
            )
                return { reason: 'The route must include a station of this company.' }
        }
        const payments = trace.visits.map((visit) => ({
            locationId: visit.locationId,
            nodeId: visit.nodeId,
            amount: this.revenue(visit, definition)
        }))
        return {
            result: {
                ...route,
                visits: trace.visits.map(({ locationId, nodeId }) => ({ locationId, nodeId })),
                payments,
                distance,
                revenue: payments.reduce((sum, payment) => sum + payment.amount, 0)
            }
        }
    }
    evaluate(companyId: string, routes: readonly TrainRoute[]): OperatingEvaluation {
        if (this.state.routeStep?.companyId !== companyId || this.state.routeStep.result)
            return { reason: 'This company is not running trains.' }
        if (getCompany(this.state, companyId).closed)
            return { reason: 'A closed company cannot run trains.' }
        const trains = new Set<string>(),
            resources = new Set<string>(),
            results: RouteResult[] = []
        for (const route of routes) {
            if (trains.has(route.trainId)) return { reason: 'Each train may run only once.' }
            trains.add(route.trainId)
            const evaluation = this.evaluateRoute(companyId, route)
            if (!evaluation.result) return evaluation
            const trace = this.network.trace(route.start, route.paths).trace!
            if (trace.resources.some((key) => resources.has(key)))
                return { reason: 'The submitted routes share track or a hex border.' }
            for (const key of trace.resources) resources.add(key)
            results.push(evaluation.result)
        }
        return {
            result: {
                companyId,
                routes: results,
                revenue: results.reduce((sum, route) => sum + route.revenue, 0)
            }
        }
    }
    private distance(train: TrainDefinition, trace: RouteTrace): number {
        if (train.distance.measure === 'hex-edges') return trace.crossings
        return trace.visits.filter(
            (visit) => train.distance.measure === 'revenue-centers' || visit.node.kind !== 'town'
        ).length
    }
    private revenue(visit: RouteVisit, train: TrainDefinition): number {
        return routeRevenue(visit.node.revenue, this.rules.revenueStage(this.state, train))
    }
}
