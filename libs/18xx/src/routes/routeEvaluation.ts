import { trainsOwnedBy } from '../trains/train.js'
import { hasStationRoute } from '../trains/trainRequirement.js'
import { routeRevenue } from './routeRevenue.js'
import {
    payingRouteStops,
    routeConnectionBonuses,
    type RouteRevenueStop,
    type RouteRevenuePolicy
} from './routeScoring.js'
import { controllingOwner, getCompany, sameOwner } from '../finance/finance.js'
import { RailwayMapState } from '../map/mapState.js'
import { cityIsBlocked } from '../map/station.js'
import type { RailwayMap } from '../map/map.js'
import type { TileSet } from '../tiles/inventory.js'
import type { TrainDefinition, Train } from '../trains/train.js'
import type { TileNode } from '../tiles/tile.js'
import type { TrainDepot } from '../trains/trainDepot.js'
import { RouteNetwork, type RouteTrace, type RouteVisit } from './routeNetwork.js'
import type {
    OperatingResult,
    RevenueCenter,
    RouteBonus,
    RouteResult,
    TrainRunningState,
    TrainRoute
} from './route.js'
export type { RouteRevenueStop } from './routeScoring.js'
export interface RouteRules {
    canOperate?(state: TrainRunningState, playerId: string, companyId: string): boolean
    longestRouteBonusPerStop?(state: TrainRunningState, companyId: string): number
    /** Names the longest route's per-stop bonus in recorded runs. */
    longestRouteBonusLabel?: string
    canRunTrain?(state: TrainRunningState, train: Train): boolean
    revenuePolicy?(train: TrainDefinition): RouteRevenuePolicy

    map: RailwayMap
    tileSet: TileSet
    depot: TrainDepot
    revenueStage(state: TrainRunningState, train: TrainDefinition): readonly string[]
    requiresCity(train: TrainDefinition): boolean
    /**
     * A stop's own value for the company, from its printed value at the current stage, where a
     * title changes it, such as a destination worth nothing on its first run.
     */
    stopRevenue?(
        state: TrainRunningState,
        companyId: string,
        center: RevenueCenter,
        printed: number
    ): number
    /** Whether the company may visit or pass through a revenue center, such as a rights hex. */
    stopAllowed?(state: TrainRunningState, companyId: string, center: RevenueCenter): boolean
    /** A route may visit only one revenue center in each hex. */
    oneStopPerHex?: true
    /** What a route earns for each hex it passes through or stops in, once per route. */
    hexBonus?(state: TrainRunningState, locationId: string): number
    /** Names a hex's bonus in recorded runs. */
    hexBonusLabel?(state: TrainRunningState, locationId: string): string | undefined
    /** What the train earns beyond the stop's value for stopping at a revenue center. */
    stopBonus?(
        state: TrainRunningState,
        train: TrainDefinition,
        companyId: string,
        center: RevenueCenter
    ): number
    /** Names a stop's bonus in recorded runs. */
    stopBonusLabel?(
        state: TrainRunningState,
        train: TrainDefinition,
        companyId: string,
        center: RevenueCenter
    ): string | undefined
}
/** A revenue center's value for a company's train: its printed stage value as the title adjusts it. */
export function stopValue(
    state: TrainRunningState,
    rules: Pick<RouteRules, 'revenueStage' | 'stopRevenue'>,
    companyId: string,
    center: RevenueCenter,
    node: Exclude<TileNode, { kind: 'junction' }>,
    train: TrainDefinition
): number {
    const printed = routeRevenue(node.revenue, rules.revenueStage(state, train))
    return rules.stopRevenue?.(state, companyId, center, printed) ?? printed
}
export type RouteEvaluationResult =
    { result: RouteResult; reason?: never } | { result?: never; reason: string }
export type OperatingEvaluation =
    { result: OperatingResult; reason?: never } | { result?: never; reason: string }
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
        return (
            !this.runnableTrains(companyId).length ||
            !hasStationRoute(this.network.mapState, this.state, companyId)
        )
    }
    canAct(playerId: string, companyId: string): boolean {
        return (
            this.state.routeStep?.companyId === companyId &&
            !this.state.routeStep.result &&
            !getCompany(this.state, companyId).closed &&
            (this.rules.canOperate
                ? this.rules.canOperate(this.state, playerId, companyId)
                : controllingOwner(this.state, companyId)?.playerId === playerId)
        )
    }
    runnableTrains(companyId: string): Train[] {
        return trainsOwnedBy(this.state, { kind: 'company', companyId }).filter(
            (train) => this.rules.canRunTrain?.(this.state, train) ?? true
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
        if (this.rules.canRunTrain?.(this.state, train) === false)
            return { reason: 'This train cannot run this operating round.' }
        const definition = this.rules.depot.trainDefinition(train.definitionId)
        const traced = this.network.trace(route.start, route.paths)
        if (!traced.trace) return { reason: traced.reason }
        const trace = traced.trace
        const seen = new Set<string>()
        for (const [index, visit] of trace.visits.entries()) {
            const key = JSON.stringify([visit.locationId, visit.nodeId])
            if (seen.has(key)) return { reason: 'A train cannot revisit a revenue center.' }
            seen.add(key)
            if (this.rules.stopAllowed?.(this.state, companyId, visit) === false)
                return { reason: 'This company may not use that revenue center.' }
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
        const repeatedGroup = this.repeatedStopGroup(trace)
        if (repeatedGroup) return { reason: `A route may visit ${repeatedGroup} only once.` }
        if (this.rules.oneStopPerHex) {
            const locations = trace.visits.map((visit) => visit.locationId)
            if (new Set(locations).size !== locations.length)
                return { reason: 'A route may stop only once in each hex.' }
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
        const visits = trace.visits.map((visit): RouteRevenueStop => {
            const bonusLabel = this.rules.stopBonusLabel?.(this.state, definition, companyId, visit)
            return {
                locationId: visit.locationId,
                nodeId: visit.nodeId,
                amount: this.revenue(companyId, visit, definition),
                bonus: this.rules.stopBonus?.(this.state, definition, companyId, visit) ?? 0,
                ...(bonusLabel ? { bonusLabel } : {}),
                companyStation: this.state.stations.some(
                    (station) =>
                        station.status === 'placed' &&
                        station.companyId === companyId &&
                        station.position.locationId === visit.locationId &&
                        station.position.nodeId === visit.nodeId
                )
            }
        })
        const policy = this.rules.revenuePolicy?.(definition) ?? {}
        const paying = payingRouteStops(visits, policy)
        const payments = paying.map(({ locationId, nodeId, amount }) => ({
            locationId,
            nodeId,
            amount
        }))
        const bonuses = [...this.bonuses(route, paying), ...routeConnectionBonuses(paying, policy)]
        return {
            result: {
                ...route,
                visits: trace.visits.map(({ locationId, nodeId }) => ({ locationId, nodeId })),
                payments,
                ...(bonuses.length ? { bonuses } : {}),
                distance,
                revenue: [...payments, ...bonuses].reduce((sum, item) => sum + item.amount, 0)
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
        const bonusPerStop = this.rules.longestRouteBonusPerStop?.(this.state, companyId) ?? 0
        const longest = results.reduce<RouteResult | undefined>(
            (best, route) =>
                !best ||
                route.visits.length > best.visits.length ||
                (route.visits.length === best.visits.length && route.trainId > best.trainId)
                    ? route
                    : best,
            undefined
        )
        const scored = results.map((route): RouteResult => {
            const bonuses =
                bonusPerStop > 0 && route === longest
                    ? route.visits.map((visit) => ({
                          locationId: visit.locationId,
                          amount: bonusPerStop,
                          ...(this.rules.longestRouteBonusLabel
                              ? { label: this.rules.longestRouteBonusLabel }
                              : {})
                      }))
                    : []
            return bonuses.length
                ? {
                      ...route,
                      bonuses: [...(route.bonuses ?? []), ...bonuses],
                      revenue: route.revenue + bonuses.reduce((sum, bonus) => sum + bonus.amount, 0)
                  }
                : route
        })
        return {
            result: {
                companyId,
                routes: scored,
                revenue: scored.reduce((sum, route) => sum + route.revenue, 0)
            }
        }
    }
    private bonuses(route: TrainRoute, paying: readonly RouteRevenueStop[]): RouteBonus[] {
        const hexes = new Set([
            route.start.locationId,
            ...route.paths.map((path) => path.locationId)
        ])
        return [
            ...paying.map((stop) => ({
                locationId: stop.locationId,
                amount: stop.bonus,
                ...(stop.bonusLabel ? { label: stop.bonusLabel } : {})
            })),
            ...[...hexes].map((locationId) => {
                const label = this.rules.hexBonusLabel?.(this.state, locationId)
                return {
                    locationId,
                    amount: this.rules.hexBonus?.(this.state, locationId) ?? 0,
                    ...(label ? { label } : {})
                }
            })
        ].filter((bonus) => bonus.amount > 0)
    }
    private repeatedStopGroup(trace: RouteTrace): string | undefined {
        const groups = trace.visits.flatMap(
            (visit) => this.rules.map.location(visit.locationId).stopGroup ?? []
        )
        return groups.find((group, index) => groups.indexOf(group) !== index)
    }
    private distance(train: TrainDefinition, trace: RouteTrace): number {
        if (train.distance.measure === 'hex-edges') return trace.crossings
        return trace.visits.filter(
            (visit) => train.distance.measure === 'revenue-centers' || visit.node.kind !== 'town'
        ).length
    }
    private revenue(companyId: string, visit: RouteVisit, train: TrainDefinition): number {
        return stopValue(this.state, this.rules, companyId, visit, visit.node, train)
    }
}
