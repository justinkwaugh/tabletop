import * as Type from 'typebox'
import type { RunningGauge, TrackGauge } from '@tabletop/18xx'

export type SolverStop = {
    token: boolean
    blocked: boolean
    city: boolean
    town: boolean
    hex: number
    endpoint: boolean
    allowed: boolean
    groups: number[]
}
export type SolverArc = {
    from: number | null
    to: number | null
    next: number[]
    resources: number[]
    junctions: number[]
    path: number
    hex: number
    terminal: boolean
    /** A route runs along the arc only from a stop at or after one of its company's stations. */
    departs_terminal: boolean
    crossings: number
    /** The path's gauge on the wire: a running gauge, or dual. */
    gauge: RunningGauge | TrackGauge
}
export type SolverTrain = {
    id: string
    distance: number
    /** What a hex side costs on a connection whose track is standard, narrow, or dual throughout. */
    crossing_costs: [number, number, number]
    requires_city: boolean
    visit_costs: number[]
    revenues: number[]
    first_bonus: number[]
    paying_stop_limit: number | null
    /** Stops called at without counting toward the train, which pay outside the paying limit. */
    uncounted?: boolean[]
    /** Tokened-out cities the train may run through on its own allowance, which pay it nothing. */
    blocked_passes?: number
    require_paying_token: boolean
    bonuses_along_route: boolean
    major_limit: number | null
    connection_bonuses: {
        from: (number | null)[]
        to: (number | null)[]
        ends_only: boolean
        /** Stops the route must also call at, one of each mask's, for the bonus. */
        requires?: boolean[][]
    }[]
    interconnections: { from: number[]; to: number[]; amount: number }[]
    allowed_stops: boolean[]
    /** The stops the train may pass without calling at them. */
    optional: boolean[]
    /** What calling at each stop pays the treasury beside the route's revenue. */
    subsidies: number[]
    fleet?: {
        paying: boolean[]
        limited: boolean[]
        paying_limit: number | null
        hex_subsidy: number
        freight: 'required' | 'optional' | null
    }
}
export type SolverFleet = {
    shared_track: boolean
    pay_once: boolean
    payment_groups: number[]
    connectivity: { root: number | null; stops: boolean[] } | null
    minimum_cities: number
    coordinates: { q: number; r: number }[]
    bonus_per_hex: number
    end_rates: number[]
    offboard_distance: boolean
}
export type SolverProblem = {
    version: number
    stops: SolverStop[]
    arcs: SolverArc[]
    trains: SolverTrain[]
    resource_count: number
    junction_count: number
    group_count: number
    hex_bonuses: number[]
    longest_route_bonus_per_stop: number
    minimum_cities_and_towns: number
    /** A route may not leave a hex and enter it again. */
    no_reentry: boolean
    /** The hexes, by index, a route may not leave and enter again, when not every hex. */
    no_reentry_hexes?: boolean[]
    /** How many blocked cities or towns the company's routes may run through, all together. */
    blocked_passes: number
    /** The most of the company's routes that may stop in each of these stop groups. */
    group_route_limits?: { group: number; routes: number }[]
    budget_ms: number
    /**
     * The time the search's stages are paced for, where the time left to it is not the time it
     * was planned with: one of several searches under one limit takes the same course whatever
     * the others left it.
     */
    pace_ms?: number
    memory_budget_bytes: number
    fleet?: SolverFleet
}
const Index = Type.Integer({ minimum: 0 })
const Time = Type.Number({ minimum: 0 })
export const SolverSolution = Type.Object({
    revenue: Index,
    subsidy: Index,
    routes: Type.Array(
        Type.Object({
            train: Index,
            connections: Type.Array(
                Type.Object({ from: Index, to: Index, paths: Type.Array(Index) })
            ),
            extension: Type.Array(Index)
        })
    ),
    exhaustive: Type.Boolean(),
    path_exhaustive: Type.Boolean(),
    combination_exhaustive: Type.Boolean(),
    candidates: Type.Array(Index),
    memory_limited: Type.Boolean(),
    expansions: Index,
    connections: Index,
    compile_ms: Time,
    path_ms: Time,
    combination_ms: Time
})
export type SolverSolution = Type.Static<typeof SolverSolution>
export const SolverError = Type.Object({ error: Type.String() })
