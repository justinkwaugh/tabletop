import { stretchWeight, trainsOwnedBy } from '../trains/train.js'
import { actsFor } from '../finance/receivership.js'
import { hasStationRoute } from '../trains/trainRequirement.js'
import { routeRevenue } from './routeRevenue.js'
import {
    payingRouteStops,
    bonusRoute,
    routeBestStopBonuses,
    routeInterconnectionBonus,
    routeStopBonuses,
    type BestStopBonus,
    type RouteRevenueStop,
    type RouteRevenuePolicy,
    type RouteShape
} from './routeScoring.js'
import { getCompany, sameOwner } from '../finance/finance.js'
import { RailwayMapState } from '../map/mapState.js'
import { cityIsBlocked, sameCenter, usesStationAt } from '../map/station.js'
import type { RailwayMap } from '../map/map.js'
import type { TileSet } from '../tiles/inventory.js'
import type { TrainDefinition, Train } from '../trains/train.js'
import type { TileNode } from '../tiles/tile.js'
import type { TrainDepot } from '../trains/trainDepot.js'
import {
    RouteNetwork,
    type RouteTrace,
    type RouteVisit,
    type TrackStretch
} from './routeNetwork.js'
import type { FleetRoute, FleetRules } from './fleetRules.js'
import { fleetRouteReason, settleFleetRoutes } from './fleetSettlement.js'
import { assert, assertExists } from '@tabletop/common'
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
    /** What earns the longest route's per-stop bonus, by the id the title names. */
    longestRouteBonusSourceId?: string
    canRunTrain?(state: TrainRunningState, train: Train): boolean
    revenuePolicy?(
        train: TrainDefinition,
        state: TrainRunningState,
        companyId: string
    ): RouteRevenuePolicy
    /**
     * Stops worth the best value among the route's other paying stops, for this company. A
     * title with a paying-stop limit chooses the paying stops without these bonuses.
     */
    bestStopBonuses?(
        state: TrainRunningState,
        companyId: string,
        train: TrainDefinition
    ): readonly BestStopBonus[]

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
    /**
     * Whether the company may visit or pass through a revenue center, such as a rights hex, with
     * the train where one is running. Without a train, as when finding what a company reaches,
     * it answers whether any of the company's trains may.
     */
    stopAllowed?(
        state: TrainRunningState,
        companyId: string,
        center: RevenueCenter,
        train?: TrainDefinition
    ): boolean
    /** Why a complete route may not run as traced, such as one ending at a town, if it may not. */
    routeAllowed?(
        state: TrainRunningState,
        companyId: string,
        train: TrainDefinition,
        visits: readonly RouteVisit[]
    ): string | undefined
    /** Trains whose routes are valued and checked together rather than one by one. */
    fleet?: FleetRules
    /**
     * Stops one route must run between, ending at both, before the rest of the fleet may run, as a
     * connection run from a company's home to its destination; other trains run as usual.
     */
    requiredRouteEnds?(
        state: TrainRunningState,
        companyId: string
    ): readonly RevenueCenter[] | undefined
    /** A route may visit only one revenue center in each hex. */
    oneStopPerHex?: true
    /** Cities and towns a complete route must visit; offboards do not count toward them. */
    minimumCitiesAndTowns?: number
    /** What a route earns for each hex it passes through or stops in, once per route. */
    hexBonus?(state: TrainRunningState, locationId: string): number
    /** What earns a hex's bonus, by the ids the title names. */
    hexBonusSourceIds?(state: TrainRunningState, locationId: string): readonly string[]
    /** What the train earns beyond the stop's value for stopping at a revenue center. */
    stopBonus?(
        state: TrainRunningState,
        train: TrainDefinition,
        companyId: string,
        center: RevenueCenter
    ): number
    /** What earns a stop's bonus, by the ids the title names. */
    stopBonusSourceIds?(
        state: TrainRunningState,
        train: TrainDefinition,
        companyId: string,
        center: RevenueCenter
    ): readonly string[]
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
function endsWithin(visits: readonly RevenueCenter[], ends: readonly RevenueCenter[]): boolean {
    const within = (stop: RevenueCenter | undefined) =>
        !!stop && ends.some((end) => sameCenter(end, stop))
    return visits.length >= 2 && within(visits[0]) && within(visits[visits.length - 1])
}
type MeasuredTrace = {
    visits: readonly RouteVisit[]
    crossings: number
    stretches: readonly TrackStretch[]
}
/**
 * How far a route runs by the train's measure of distance. A stretch of track still unfinished
 * counts as far as its gauge yet decides.
 */
export function routeDistance(train: TrainDefinition, trace: MeasuredTrace): number {
    if (train.distance.measure === 'hex-edges')
        return train.distance.gaugeWeights
            ? trace.stretches.reduce(
                  (sum, { gauge, crossings }) =>
                      sum + crossings * stretchWeight(train.distance, gauge),
                  0
              )
            : trace.crossings
    return trace.visits.filter(
        (visit) => train.distance.measure === 'revenue-centers' || visit.node.kind !== 'town'
    ).length
}
export function exceedsRouteDistance(train: TrainDefinition, trace: MeasuredTrace): boolean {
    const { maximum, extraTowns = 0 } = train.distance
    if (maximum === 'unlimited') return false
    const distance = routeDistance(train, trace)
    if (!extraTowns) return distance > maximum
    const towns = trace.visits.filter((visit) => visit.node.kind === 'town').length
    return distance > maximum + extraTowns || distance - towns > maximum
}
export type RouteEvaluationResult =
    { result: RouteResult; reason?: never } | { result?: never; reason: string }
export type FleetRouteEvaluation =
    | { route: FleetRoute; resources: readonly string[]; reason?: never }
    | { route?: never; resources?: never; reason: string }
export type OperatingEvaluation =
    { result: OperatingResult; reason?: never } | { result?: never; reason: string }
export class RouteEvaluation {
    readonly network: RouteNetwork
    constructor(
        private readonly state: TrainRunningState,
        readonly rules: RouteRules
    ) {
        assert(
            !(rules.fleet && rules.longestRouteBonusPerStop),
            'A fleet settles its own bonuses, not the longest route’s'
        )
        this.network = new RouteNetwork(
            new RailwayMapState(rules.map, rules.tileSet, state.tileInventory)
        )
    }
    cannotRun(companyId: string): boolean {
        return (
            !this.runnableTrains(companyId).length ||
            !hasStationRoute(
                this.network.mapState,
                this.state,
                companyId,
                undefined,
                (this.rules.minimumCitiesAndTowns ?? 0) >= 2
            )
        )
    }
    canAct(playerId: string | undefined, companyId: string): boolean {
        return (
            this.state.routeStep?.companyId === companyId &&
            !this.state.routeStep.result &&
            !getCompany(this.state, companyId).closed &&
            (playerId && this.rules.canOperate
                ? this.rules.canOperate(this.state, playerId, companyId)
                : actsFor(this.state, playerId, companyId))
        )
    }
    runnableTrains(companyId: string): Train[] {
        return trainsOwnedBy(this.state, { kind: 'company', companyId }).filter(
            (train) => this.rules.canRunTrain?.(this.state, train) ?? true
        )
    }
    evaluateRoute(companyId: string, route: TrainRoute, complete = true): RouteEvaluationResult {
        const evaluated = this.evaluateTraced(companyId, route, complete)
        return evaluated.result ? { result: evaluated.result } : { reason: evaluated.reason }
    }
    /** A complete route as its train runs it in a fleet, and the track it uses. */
    evaluateFleetRoute(companyId: string, route: TrainRoute): FleetRouteEvaluation {
        const evaluated = this.evaluateTraced(companyId, route, true)
        if (!evaluated.result) return { reason: evaluated.reason }
        const { result, trace, train } = evaluated
        const resources = route.extension
            ? this.network.trace(route.start, [...route.paths, ...route.extension]).trace!.resources
            : trace.resources
        const locationIds = [route.start.locationId]
        for (const { locationId } of route.paths)
            if (locationIds.at(-1) !== locationId) locationIds.push(locationId)
        return { route: { result, train, visits: trace.visits, locationIds }, resources }
    }
    private evaluateTraced(
        companyId: string,
        route: TrainRoute,
        complete: boolean
    ):
        | { result: RouteResult; trace: RouteTrace; train: TrainDefinition; reason?: never }
        | { result?: never; reason: string } {
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
            if (this.rules.stopAllowed?.(this.state, companyId, visit, definition) === false)
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
        const distance = routeDistance(definition, trace)
        if (exceedsRouteDistance(definition, trace))
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
            const minimumCitiesAndTowns = this.rules.minimumCitiesAndTowns ?? 0
            if (
                trace.visits.filter((visit) => visit.node.kind !== 'offboard').length <
                minimumCitiesAndTowns
            )
                return {
                    reason: `A route must visit at least ${minimumCitiesAndTowns} cities or towns.`
                }
            if (
                this.rules.requiresCity(definition) &&
                !trace.visits.some((visit) => visit.node.kind === 'city')
            )
                return { reason: 'This train must visit a city.' }
            if (
                !trace.visits.some((visit) =>
                    usesStationAt(this.state, companyId, visit.locationId, visit.nodeId)
                )
            )
                return { reason: 'The route must include a station of this company.' }
            const fleetReason = this.rules.fleet && fleetRouteReason(this.rules.fleet, trace.visits)
            if (fleetReason) return { reason: fleetReason }
            const shapeReason = this.rules.routeAllowed?.(
                this.state,
                companyId,
                definition,
                trace.visits
            )
            if (shapeReason) return { reason: shapeReason }
        }
        const visits = trace.visits.map((visit): RouteRevenueStop => {
            const bonusSourceIds =
                this.rules.stopBonusSourceIds?.(this.state, definition, companyId, visit) ?? []
            return {
                locationId: visit.locationId,
                nodeId: visit.nodeId,
                amount: this.revenue(companyId, visit, definition),
                bonus: this.rules.stopBonus?.(this.state, definition, companyId, visit) ?? 0,
                ...(bonusSourceIds.length ? { bonusSourceIds } : {}),
                companyStation: usesStationAt(this.state, companyId, visit.locationId, visit.nodeId)
            }
        })
        const policy = this.rules.revenuePolicy?.(definition, this.state, companyId) ?? {}
        const extension = route.extension ? this.extension(companyId, route, definition) : undefined
        if (extension?.reason) return { reason: extension.reason }
        const shape: RouteShape = {
            ends: [trace.visits[0], trace.visits[trace.visits.length - 1]],
            ...(extension?.locationId ? { extensionLocationId: extension.locationId } : {})
        }
        const paying = payingRouteStops(visits, policy, shape)
        const payments = paying.map(({ locationId, nodeId, amount }) => ({
            locationId,
            nodeId,
            amount
        }))
        const bonused = bonusRoute(visits, paying, policy, shape)
        const bonuses = [
            ...this.bonuses(route, paying),
            ...routeStopBonuses(bonused.stops, policy, bonused.shape),
            ...routeBestStopBonuses(
                paying,
                this.rules.bestStopBonuses?.(this.state, companyId, definition) ?? []
            )
        ]
        if (extension && !routeInterconnectionBonus(bonused.stops, policy, bonused.shape))
            return { reason: 'The extension earns no interconnection.' }
        return {
            result: {
                ...route,
                definitionId: train.definitionId,
                visits: trace.visits.map(({ locationId, nodeId }) => ({ locationId, nodeId })),
                payments,
                ...(bonuses.length ? { bonuses } : {}),
                distance,
                revenue: [...payments, ...bonuses].reduce((sum, item) => sum + item.amount, 0)
            },
            trace,
            train: definition
        }
    }
    evaluate(companyId: string, routes: readonly TrainRoute[]): OperatingEvaluation {
        if (this.state.routeStep?.companyId !== companyId || this.state.routeStep.result)
            return { reason: 'This company is not running trains.' }
        if (getCompany(this.state, companyId).closed)
            return { reason: 'A closed company cannot run trains.' }
        const trains = new Set<string>(),
            resources = new Set<string>(),
            evaluated: FleetRoute[] = []
        const sharedTrack = this.rules.fleet?.sharedTrack
        for (const route of routes) {
            if (trains.has(route.trainId)) return { reason: 'Each train may run only once.' }
            trains.add(route.trainId)
            const evaluation = this.evaluateFleetRoute(companyId, route)
            if (!evaluation.route) return { reason: evaluation.reason }
            if (!sharedTrack) {
                if (evaluation.resources.some((key) => resources.has(key)))
                    return { reason: 'The submitted routes share track or a hex border.' }
                for (const key of evaluation.resources) resources.add(key)
            }
            evaluated.push(evaluation.route)
        }
        const results = evaluated.map((route) => route.result)
        const requiredEnds = this.rules.requiredRouteEnds?.(this.state, companyId)
        if (requiredEnds && !results.some((route) => endsWithin(route.visits, requiredEnds)))
            return { reason: 'One train must run between the required stops, and no further.' }
        if (this.rules.fleet) return this.settleFleet(companyId, evaluated)
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
                          ...(this.rules.longestRouteBonusSourceId
                              ? { sourceIds: [this.rules.longestRouteBonusSourceId] }
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
    /** What a fleet of evaluated routes earns together, as its title settles them. */
    settleFleet(companyId: string, routes: readonly FleetRoute[]): OperatingEvaluation {
        const fleet = this.rules.fleet
        assertExists(fleet, 'Only a fleet’s routes settle together')
        if (!routes.length) return { result: { companyId, routes: [], revenue: 0 } }
        const settled = settleFleetRoutes(this.state, this.rules, companyId, routes)
        if (settled.reason !== undefined) return { reason: settled.reason }
        const subsidy = settled.subsidy ?? 0
        assert(
            settled.routes.length === routes.length &&
                settled.routes.every(
                    (route, index) =>
                        route.trainId === routes[index].result.trainId &&
                        route.revenue ===
                            [...route.payments, ...(route.bonuses ?? [])].reduce(
                                (sum, item) => sum + item.amount,
                                0
                            )
                ) &&
                Number.isSafeInteger(subsidy) &&
                subsidy >= 0,
            'A fleet settles each of its routes for its payments and bonuses'
        )
        return {
            result: {
                companyId,
                routes: settled.routes,
                revenue: settled.routes.reduce((sum, route) => sum + route.revenue, 0),
                ...(subsidy > 0 ? { subsidy } : {})
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
                ...(stop.bonusSourceIds ? { sourceIds: [...stop.bonusSourceIds] } : {})
            })),
            ...[...hexes].map((locationId) => {
                const sourceIds = this.rules.hexBonusSourceIds?.(this.state, locationId) ?? []
                return {
                    locationId,
                    amount: this.rules.hexBonus?.(this.state, locationId) ?? 0,
                    ...(sourceIds.length ? { sourceIds: [...sourceIds] } : {})
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
    /**
     * Where a route's extension ends: it runs on from the route's end through any stops,
     * blocked or not, without counting them, and ends at a revenue center past no offboard.
     */
    private extension(
        companyId: string,
        route: TrainRoute,
        train: TrainDefinition
    ): { locationId: string; reason?: never } | { reason: string; locationId?: never } {
        const base = this.network.trace(route.start, route.paths).trace
        const extended = this.network.trace(route.start, [
            ...route.paths,
            ...(route.extension ?? [])
        ])
        if (!base || !extended.trace) return { reason: extended.reason ?? 'The route is invalid.' }
        const visits = extended.trace.visits.slice(base.visits.length)
        const end = extended.trace.end
        const last = visits.at(-1)
        if (
            !last ||
            end.endpoint.kind !== 'node' ||
            end.locationId !== last.locationId ||
            end.endpoint.nodeId !== last.nodeId
        )
            return { reason: 'End the extension at a revenue center.' }
        if (visits.slice(0, -1).some((visit) => visit.node.kind === 'offboard'))
            return { reason: 'An extension cannot pass through an offboard.' }
        if (
            visits.some(
                (visit) => this.rules.stopAllowed?.(this.state, companyId, visit, train) === false
            )
        )
            return { reason: 'This company may not use that revenue center.' }
        return { locationId: last.locationId }
    }
    private revenue(companyId: string, visit: RouteVisit, train: TrainDefinition): number {
        return stopValue(this.state, this.rules, companyId, visit, visit.node, train)
    }
}
