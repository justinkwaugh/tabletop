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
import { cityIsBlocked, companyStationCenters, sameCenter, usesStationAt } from '../map/station.js'
import type { RailwayMap } from '../map/map.js'
import type { TileSet } from '../tiles/inventory.js'
import type { TrainDefinition, Train } from '../trains/train.js'
import { isHalt, type TileNode } from '../tiles/tile.js'
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
     * A stop's own value for the company and train, from its printed value at the current stage,
     * where a title changes it, such as a destination worth nothing on its first run or a city
     * doubled for 1849's E trains.
     */
    stopRevenue?(
        state: TrainRunningState,
        companyId: string,
        center: RevenueCenter,
        printed: number,
        train: TrainDefinition
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
    /**
     * Whether the company's trains may pass through this city though other companies' stations
     * fill it, as 18RoyalGorge's Hanging Bridge Lease runs through the gorge (G3).
     */
    passesStations?(state: TrainRunningState, companyId: string, center: RevenueCenter): boolean
    /** Why a complete route may not run as traced, such as one ending at a town, if it may not. */
    routeAllowed?(
        state: TrainRunningState,
        companyId: string,
        train: TrainDefinition,
        visits: readonly RouteVisit[]
    ): string | undefined
    /**
     * Whether the train stops at a revenue center on its route. It passes one it does not stop
     * at, uncounted and unpaid, and cannot end there, as 1822's E trains stop only at their
     * company's stations (§5.5.8). A train stops everywhere unless the title says otherwise;
     * such a train shares track, so that its route is found apart from the others'.
     */
    stopsAt?(
        state: TrainRunningState,
        companyId: string,
        center: RevenueCenter,
        train: TrainDefinition
    ): boolean
    /**
     * How a train runs with rolling stock attached, or why it may not carry it, as an 1822
     * Pullman lets a train pass towns uncounted (§5.5.6).
     */
    attachedDefinition?(
        state: TrainRunningState,
        train: TrainDefinition,
        attachments: readonly TrainDefinition[]
    ): TrainDefinition | string
    /**
     * How far the company's train runs this turn where the title lengthens it, as 18RoyalGorge's
     * Track Engineer and coal cubes add stops to a train for one run (B5, Y3, G6).
     */
    extendedDefinition?(
        state: TrainRunningState,
        companyId: string,
        train: Train,
        definition: TrainDefinition
    ): TrainDefinition
    /**
     * What the bank pays the treasury for a run beside its revenue, such as an 1822 mail
     * contract's half of a route's two ends (§3.1.12). It is judged on the routes as run, so a
     * run found for its revenue is not searched for a greater subsidy.
     */
    runSubsidy?(state: TrainRunningState, companyId: string, routes: readonly RouteResult[]): number
    /**
     * What the company's run earns beside its routes, part of its revenue, as 1880's bonus from
     * the share price chart (§X); judged on the company, not the routes, so a run found for its
     * routes is not searched for it.
     */
    runBonus?(state: TrainRunningState, companyId: string): number
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
    /**
     * Whether the train may pass the stop without calling at it, as 1860's trains pass small
     * stations and halts. A stop passed by neither counts toward the train's distance nor pays,
     * and no route ends at one; a route calls at the optional stops worth most to it, revenue
     * and subsidy together, while its distance allows.
     */
    stopOptional?(
        state: TrainRunningState,
        companyId: string,
        center: RevenueCenter,
        train: TrainDefinition
    ): boolean
    /**
     * What calling at the stop pays the company's treasury beside the route's revenue, as an
     * 1860 halt's £10 subsidy.
     */
    stopSubsidy?(
        state: TrainRunningState,
        companyId: string,
        center: RevenueCenter,
        train: TrainDefinition
    ): number
    /** Whether a route may not enter a hex again once it has left it, as in 1860. */
    forbidsHexReentry?(state: TrainRunningState): boolean
    /**
     * How many tokened-out cities the company's trains may run through in one run, all its
     * routes together, as 1860 lets one train pass one (Running Trains); none unless given.
     */
    blockedCityPasses?(state: TrainRunningState, companyId: string): number
    /**
     * A train the company runs without owning it, as an insolvent 1860 company leases the bank's
     * smallest (Insolvency).
     */
    leasedTrain?(state: TrainRunningState, companyId: string): Train | undefined
    /** Cities and towns a complete route must visit; offboards do not count toward them. */
    minimumCitiesAndTowns?: number
    /**
     * What a route earns for each hex it passes through or stops in, once per route, for the
     * company running it; a charge where negative, as 1880's ferry fee (§X Calculating Income).
     */
    hexBonus?(state: TrainRunningState, locationId: string, companyId: string): number
    /** What earns a hex's bonus, by the ids the title names. */
    hexBonusSourceIds?(
        state: TrainRunningState,
        locationId: string,
        companyId: string
    ): readonly string[]
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
    return rules.stopRevenue?.(state, companyId, center, printed, train) ?? printed
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
        (visit) =>
            !visit.node.uncounted &&
            (train.distance.measure === 'revenue-centers' || visit.node.kind !== 'town')
    ).length
}
/** What the routes' stops pay the treasury beside their revenue. */
function routeSubsidies(routes: readonly RouteResult[]): number {
    return routes.reduce((sum, route) => sum + (route.subsidy ?? 0), 0)
}

/** Whether the route leaves a hex and later enters it again. */
function reentersHex(route: TrainRoute): boolean {
    const hexes = [route.start.locationId]
    for (const { locationId } of route.paths)
        if (hexes.at(-1) !== locationId) hexes.push(locationId)
    return new Set(hexes).size !== hexes.length
}

export function exceedsRouteDistance(train: TrainDefinition, trace: MeasuredTrace): boolean {
    const { maximum, extraTowns = 0 } = train.distance
    if (maximum === 'unlimited') return false
    const distance = routeDistance(train, trace)
    if (!extraTowns) return distance > maximum
    const towns = trace.visits.filter(
        (visit) => visit.node.kind === 'town' && !visit.node.uncounted
    ).length
    return distance > maximum + extraTowns || distance - towns > maximum
}
export type RouteEvaluationResult =
    { result: RouteResult; reason?: never } | { result?: never; reason: string }
export type FleetRouteEvaluation =
    | { route: FleetRoute; resources: readonly string[]; blockedPasses: number; reason?: never }
    | { route?: never; resources?: never; blockedPasses?: never; reason: string }
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
        const trains = this.runnableTrains(companyId)
        if (
            trains.some(
                (train) => this.rules.depot.trainDefinition(train.definitionId).distance.stationRun
            ) &&
            companyStationCenters(this.state, companyId).length
        )
            return false
        return (
            !trains.length ||
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
    /** Whether a route may not run through the stop: an offboard, or a city closed to the company. */
    passageBlocked(companyId: string, center: RevenueCenter, node: TileNode): boolean {
        return (
            node.kind === 'offboard' ||
            (cityIsBlocked(this.state, this.rules.map, companyId, center.locationId, node) &&
                !this.rules.passesStations?.(this.state, companyId, center))
        )
    }
    runnableTrains(companyId: string): Train[] {
        const leased = this.rules.leasedTrain?.(this.state, companyId)
        return [
            ...trainsOwnedBy(this.state, { kind: 'company', companyId }),
            ...(leased ? [leased] : [])
        ].filter(
            (train) =>
                !this.rules.depot.trainDefinition(train.definitionId).attachment &&
                (this.rules.canRunTrain?.(this.state, train) ?? true)
        )
    }
    /** The rolling stock a company may attach to its trains for a run. */
    attachments(companyId: string): Train[] {
        return trainsOwnedBy(this.state, { kind: 'company', companyId }).filter(
            (train) => this.rules.depot.trainDefinition(train.definitionId).attachment
        )
    }
    /** The definition a train runs as, with whatever is attached to it for the run. */
    runningDefinition(
        companyId: string,
        train: Train,
        attachmentIds: readonly string[] = []
    ): { definition: TrainDefinition; reason?: never } | { reason: string; definition?: never } {
        const printed = this.rules.depot.trainDefinition(train.definitionId)
        if (printed.attachment)
            return { reason: 'This rolling stock runs only attached to a train.' }
        const base =
            this.rules.extendedDefinition?.(this.state, companyId, train, printed) ?? printed
        if (!attachmentIds.length) return { definition: base }
        const available = this.attachments(companyId)
        const attached = attachmentIds.map((id) => available.find((entry) => entry.id === id))
        if (attached.some((entry) => !entry))
            return { reason: 'The company does not own this rolling stock.' }
        const definition = this.rules.attachedDefinition?.(
            this.state,
            base,
            attached.flatMap((entry) =>
                entry ? [this.rules.depot.trainDefinition(entry.definitionId)] : []
            )
        )
        if (!definition) return { reason: 'This train carries no attached rolling stock.' }
        return typeof definition === 'string' ? { reason: definition } : { definition }
    }
    evaluateRoute(companyId: string, route: TrainRoute, complete = true): RouteEvaluationResult {
        const evaluated = this.evaluateTraced(companyId, route, complete)
        return evaluated.result ? { result: evaluated.result } : { reason: evaluated.reason }
    }
    /** A complete route as its train runs it in a fleet, and the track it uses. */
    evaluateFleetRoute(companyId: string, route: TrainRoute): FleetRouteEvaluation {
        const evaluated = this.evaluateTraced(companyId, route, true)
        if (!evaluated.result) return { reason: evaluated.reason }
        const { result, trace, train, stops, blockedPasses } = evaluated
        const resources = route.extension
            ? this.network.trace(route.start, [...route.paths, ...route.extension]).trace!.resources
            : trace.resources
        const locationIds = [route.start.locationId]
        for (const { locationId } of route.paths)
            if (locationIds.at(-1) !== locationId) locationIds.push(locationId)
        return {
            route: { result, train, visits: trace.visits, stops, locationIds },
            resources,
            blockedPasses
        }
    }
    private evaluateTraced(
        companyId: string,
        route: TrainRoute,
        complete: boolean
    ):
        | {
              result: RouteResult
              trace: RouteTrace
              train: TrainDefinition
              /** The stops the train calls at, the optional stops it passes left out. */
              stops: readonly RouteVisit[]
              /** The tokened-out cities the route runs through. */
              blockedPasses: number
              reason?: never
          }
        | { result?: never; reason: string } {
        const leased = this.rules.leasedTrain?.(this.state, companyId)
        const train =
            leased?.id === route.trainId
                ? leased
                : this.state.trainInventory.trains.find((train) => train.id === route.trainId)
        if (
            !train ||
            (train !== leased &&
                (train.status !== 'owned' ||
                    !sameOwner(train.owner, { kind: 'company', companyId })))
        )
            return { reason: 'The company does not own this train.' }
        if (this.rules.canRunTrain?.(this.state, train) === false)
            return { reason: 'This train cannot run this operating round.' }
        const running = this.runningDefinition(companyId, train, route.attachmentIds)
        if (!running.definition) return { reason: running.reason }
        const definition = running.definition
        const traced = this.network.trace(route.start, route.paths)
        if (!traced.trace) return { reason: traced.reason }
        const trace = traced.trace
        const stopsAt = (visit: RevenueCenter) =>
            this.rules.stopsAt?.(this.state, companyId, visit, definition) ?? true
        // What the train counts and is paid for: the stops it makes, not those it passes.
        const stopped = this.rules.stopsAt
            ? { ...trace, visits: trace.visits.filter(stopsAt) }
            : trace
        const seen = new Set<string>()
        const passableBlocks = this.rules.blockedCityPasses?.(this.state, companyId) ?? 0
        let blockedPasses = 0
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
            if (index > 0 && !isEnd && this.passageBlocked(companyId, visit, visit.node)) {
                if (visit.node.kind === 'offboard' || ++blockedPasses > passableBlocks)
                    return { reason: 'The route cannot pass through a blocked city or offboard.' }
            }
        }
        if (this.rules.forbidsHexReentry?.(this.state) && reentersHex(route))
            return { reason: 'A route may not enter a hex again once it has left it.' }
        const repeatedGroup = this.repeatedStopGroup(trace)
        if (repeatedGroup) return { reason: `A route may visit ${repeatedGroup} only once.` }
        if (this.rules.oneStopPerHex) {
            const locations = trace.visits.map((visit) => visit.locationId)
            if (new Set(locations).size !== locations.length)
                return { reason: 'A route may stop only once in each hex.' }
        }
        const called = this.calledStops(companyId, definition, stopped)
        if (!called)
            return { reason: `The route exceeds the ${definition.name} train’s distance limit.` }
        const distance = routeDistance(definition, called)
        if (
            definition.distance.standardGaugeOnly &&
            trace.stretches.some((stretch) => stretch.gauge === 'narrow')
        )
            return { reason: `The ${definition.name} train cannot run on narrow gauge.` }
        if (complete) {
            const atStation = !route.paths.length && definition.distance.stationRun === true
            if (
                !atStation &&
                (!route.paths.length ||
                    trace.end.endpoint.kind !== 'node' ||
                    !trace.visits.some(
                        (visit) =>
                            visit.locationId === trace.end.locationId &&
                            trace.end.endpoint.kind === 'node' &&
                            visit.nodeId === trace.end.endpoint.nodeId
                    ))
            )
                return { reason: 'End the route at a revenue center.' }
            if (called.visits.length < (atStation ? 1 : 2))
                return { reason: 'A route needs at least two revenue centers.' }
            const [first, last] = [trace.visits[0], trace.visits[trace.visits.length - 1]]
            if (!stopsAt(first) || !stopsAt(last))
                return { reason: `The ${definition.name} train starts and ends where it stops.` }
            if (isHalt(first.node) || isHalt(last.node))
                return { reason: 'A route neither begins nor ends at a halt.' }
            const minimumCitiesAndTowns = this.rules.minimumCitiesAndTowns ?? 0
            if (
                !atStation &&
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
            if (this.leavesTerminusAwayFromStation(companyId, trace.visits))
                return {
                    reason: 'A route runs on along terminus track only after a station of this company.'
                }
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
        const visits = called.visits.map((visit): RouteRevenueStop => {
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
            ends: [called.visits[0], called.visits[called.visits.length - 1]],
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
            ...this.bonuses(companyId, route, paying),
            ...routeStopBonuses(bonused.stops, policy, bonused.shape),
            ...routeBestStopBonuses(
                paying,
                this.rules.bestStopBonuses?.(this.state, companyId, definition) ?? []
            )
        ]
        if (extension && !routeInterconnectionBonus(bonused.stops, policy, bonused.shape))
            return { reason: 'The extension earns no interconnection.' }
        const revenue = [...payments, ...bonuses].reduce((sum, item) => sum + item.amount, 0)
        if (revenue < 0) return { reason: 'The route’s charges exceed what it earns.' }
        const subsidy = called.visits.reduce(
            (sum, visit) => sum + this.subsidy(companyId, visit, definition),
            0
        )
        return {
            result: {
                ...route,
                definitionId: train.definitionId,
                visits: trace.visits.map(({ locationId, nodeId }) => ({ locationId, nodeId })),
                payments,
                ...(bonuses.length ? { bonuses } : {}),
                distance,
                revenue,
                ...(subsidy > 0 ? { subsidy } : {})
            },
            trace,
            train: definition,
            stops: called.visits,
            blockedPasses
        }
    }
    private subsidy(companyId: string, visit: RevenueCenter, train: TrainDefinition): number {
        return this.rules.stopSubsidy?.(this.state, companyId, visit, train) ?? 0
    }
    /**
     * The stops the train calls at: every stop it may not pass, its two ends, and the optional
     * stops worth most to it, revenue and subsidy together, while its distance allows; none if
     * its required stops alone exceed it.
     */
    private calledStops(
        companyId: string,
        train: TrainDefinition,
        trace: RouteTrace
    ): RouteTrace | undefined {
        const { visits } = trace
        const optional = (visit: RouteVisit, index: number) =>
            index > 0 &&
            index < visits.length - 1 &&
            !!this.rules.stopOptional?.(this.state, companyId, visit, train)
        const required = visits.filter((visit, index) => !optional(visit, index))
        if (exceedsRouteDistance(train, { ...trace, visits: required })) return undefined
        if (required.length === visits.length) return trace
        const worth = (visit: RouteVisit) => ({
            revenue: this.revenue(companyId, visit, train),
            total: this.revenue(companyId, visit, train) + this.subsidy(companyId, visit, train)
        })
        const candidates = visits
            .filter(optional)
            .map((visit) => ({ visit, ...worth(visit) }))
            .filter((candidate) => candidate.total > 0)
            .sort((a, b) => b.total - a.total || b.revenue - a.revenue)
        const chosen = new Set<RouteVisit>(required)
        for (const { visit } of candidates) {
            chosen.add(visit)
            if (
                exceedsRouteDistance(train, {
                    ...trace,
                    visits: visits.filter((v) => chosen.has(v))
                })
            )
                chosen.delete(visit)
        }
        return { ...trace, visits: visits.filter((visit) => chosen.has(visit)) }
    }
    evaluate(companyId: string, routes: readonly TrainRoute[]): OperatingEvaluation {
        const evaluation = this.evaluateRoutes(companyId, routes)
        const bonus = evaluation.result ? (this.rules.runBonus?.(this.state, companyId) ?? 0) : 0
        assert(Number.isSafeInteger(bonus) && bonus >= 0, 'A run’s bonus is a whole amount')
        if (!evaluation.result || !bonus) return evaluation
        return {
            result: {
                ...evaluation.result,
                revenue: evaluation.result.revenue + bonus,
                bonus
            }
        }
    }
    private evaluateRoutes(companyId: string, routes: readonly TrainRoute[]): OperatingEvaluation {
        if (this.state.routeStep?.companyId !== companyId || this.state.routeStep.result)
            return { reason: 'This company is not running trains.' }
        if (getCompany(this.state, companyId).closed)
            return { reason: 'A closed company cannot run trains.' }
        const trains = new Set<string>(),
            resources = new Set<string>(),
            stations = new Set<string>(),
            evaluated: FleetRoute[] = []
        const sharedTrack = this.rules.fleet?.sharedTrack
        let blockedPasses = 0
        for (const route of routes) {
            for (const id of [route.trainId, ...(route.attachmentIds ?? [])]) {
                if (trains.has(id)) return { reason: 'Each train may run only once.' }
                trains.add(id)
            }
            const evaluation = this.evaluateFleetRoute(companyId, route)
            if (!evaluation.route) return { reason: evaluation.reason }
            blockedPasses += evaluation.blockedPasses
            if (blockedPasses > (this.rules.blockedCityPasses?.(this.state, companyId) ?? 0))
                return { reason: 'The company’s trains have passed every blocked city they may.' }
            if (!sharedTrack && !evaluation.route.train.sharesTrack) {
                if (evaluation.resources.some((key) => resources.has(key)))
                    return { reason: 'The submitted routes share track or a hex border.' }
                for (const key of evaluation.resources) resources.add(key)
            }
            if (evaluation.route.train.distance.stationRun)
                for (const visit of evaluation.route.visits) {
                    if (!usesStationAt(this.state, companyId, visit.locationId, visit.nodeId))
                        continue
                    const key = JSON.stringify([visit.locationId, visit.nodeId])
                    if (stations.has(key))
                        return {
                            reason: `Only one ${evaluation.route.train.name} train runs from each station.`
                        }
                    stations.add(key)
                }
            evaluated.push(evaluation.route)
        }
        const results = this.oncePerRun(
            companyId,
            evaluated.map((route) => route.result),
            evaluated.map((route) => route.train)
        )
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
        const subsidy =
            (this.rules.runSubsidy?.(this.state, companyId, scored) ?? 0) + routeSubsidies(scored)
        assert(Number.isSafeInteger(subsidy) && subsidy >= 0, 'A run’s subsidy is a whole amount')
        return {
            result: {
                companyId,
                routes: scored,
                revenue: scored.reduce((sum, route) => sum + route.revenue, 0),
                ...(subsidy > 0 ? { subsidy } : {})
            }
        }
    }
    /** Leaves each once-a-run bonus with the route it is worth most to, the earliest of equals. */
    private oncePerRun(
        companyId: string,
        routes: readonly RouteResult[],
        trains: readonly TrainDefinition[]
    ): RouteResult[] {
        const sourceIds = new Set(
            trains.flatMap((train) =>
                (
                    this.rules.revenuePolicy?.(train, this.state, companyId).connectionBonuses ?? []
                ).flatMap((bonus) => {
                    if (!bonus.oncePerRun) return []
                    assertExists(bonus.sourceId, 'A once-a-run bonus names its source')
                    return [bonus.sourceId]
                })
            )
        )
        let kept = [...routes]
        for (const sourceId of sourceIds) {
            const worth = (route: RouteResult) =>
                (route.bonuses ?? [])
                    .filter((bonus) => bonus.sourceIds?.includes(sourceId))
                    .reduce((sum, bonus) => sum + bonus.amount, 0)
            const best = kept.reduce((top, route) => Math.max(top, worth(route)), 0)
            const keeper = kept.find((route) => worth(route) === best)
            kept = kept.map((route) => {
                const lost = route === keeper ? 0 : worth(route)
                if (!lost) return route
                const bonuses = (route.bonuses ?? []).filter(
                    (bonus) => !bonus.sourceIds?.includes(sourceId)
                )
                const { bonuses: _bonuses, ...rest } = route
                return {
                    ...rest,
                    ...(bonuses.length ? { bonuses } : {}),
                    revenue: route.revenue - lost
                }
            })
        }
        return kept
    }
    /** What a fleet of evaluated routes earns together, as its title settles them. */
    settleFleet(companyId: string, routes: readonly FleetRoute[]): OperatingEvaluation {
        const fleet = this.rules.fleet
        assertExists(fleet, 'Only a fleet’s routes settle together')
        if (!routes.length) return { result: { companyId, routes: [], revenue: 0 } }
        const settled = settleFleetRoutes(this.state, this.rules, companyId, routes)
        if (settled.reason !== undefined) return { reason: settled.reason }
        const subsidy = (settled.subsidy ?? 0) + routeSubsidies(settled.routes)
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
    private bonuses(
        companyId: string,
        route: TrainRoute,
        paying: readonly RouteRevenueStop[]
    ): RouteBonus[] {
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
                const sourceIds =
                    this.rules.hexBonusSourceIds?.(this.state, locationId, companyId) ?? []
                return {
                    locationId,
                    amount: this.rules.hexBonus?.(this.state, locationId, companyId) ?? 0,
                    ...(sourceIds.length ? { sourceIds: [...sourceIds] } : {})
                }
            })
        ].filter((bonus) => bonus.amount !== 0)
    }
    /**
     * A train runs from its station, so a route reaching its only station across terminus track
     * would be run along that track from the far end, which ends a route (1822 §5.4.7).
     */
    private leavesTerminusAwayFromStation(
        companyId: string,
        visits: readonly RouteVisit[]
    ): boolean {
        const departure = visits.findIndex((visit, index) => index > 0 && visit.leavesAlongTerminus)
        return (
            departure > 0 &&
            !visits
                .slice(0, departure + 1)
                .some((visit) =>
                    usesStationAt(this.state, companyId, visit.locationId, visit.nodeId)
                )
        )
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
