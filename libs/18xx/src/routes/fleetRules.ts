import type { TrainDefinition } from '../trains/train.js'
import type { RouteResult, TrainRunningState } from './route.js'
import type { RouteVisit } from './routeNetwork.js'

/** A complete route as one train of a fleet runs it, evaluated on its own. */
export type FleetRoute = {
    result: RouteResult
    train: TrainDefinition
    /** The route's stops in order, with their nodes. */
    visits: readonly RouteVisit[]
    /** Every hex the route's paths enter, in order from its start's; a hex entered again repeats. */
    locationIds: readonly string[]
}

export type FleetSettlement = {
    /** The routes in the order given, each keeping its train, earning its payments and bonuses. */
    routes: RouteResult[]
    /** What the bank pays the company's treasury beside its revenue, such as a subsidy. */
    subsidy?: number
    reason?: never
}
export type FleetRejection = { reason: string; routes?: never; subsidy?: never }

/**
 * Trains whose routes are valued and checked together, such as routes that must meet or stops paid
 * once per company. A route and its reverse settle alike, and settlement reads only a route's
 * visits, hexes, train and evaluation, never which track joins them.
 */
export interface FleetRules {
    /** Trains may run over the same track; each train still never reuses its own. */
    sharedTrack?: true
    /**
     * Settles at least one evaluated route as one operation: rewrites their payments, bonuses and
     * revenue, and gives any subsidy, or the reason they may not run together.
     */
    settle(
        state: TrainRunningState,
        companyId: string,
        routes: readonly FleetRoute[]
    ): FleetSettlement | FleetRejection
    /**
     * What settlement reads of a train's route, where that is less than its stops and the hexes it
     * enters: routes with equal keys settle alike, so a search tries only the shortest. The stops
     * and hexes come in one direction for a route and its reverse.
     */
    routeKey?(
        train: TrainDefinition,
        visits: readonly RouteVisit[],
        locationIds: readonly string[]
    ): string
    /**
     * At most what the route adds to a fleet already running `chosen`, revenue and subsidy
     * together, whatever runs later: in any order, a fleet settles for no more than the sum of each
     * route's bound given the routes before it, and a bound never grows as `chosen` does. Without
     * it, a route is bounded by what it earns running alone, and unbounded if it cannot run alone,
     * so a title whose fleets can earn more than their routes alone must give one.
     */
    bound?(
        state: TrainRunningState,
        companyId: string,
        route: FleetRoute,
        chosen: readonly FleetRoute[]
    ): number
}
