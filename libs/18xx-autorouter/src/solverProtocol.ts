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
    require_paying_token: boolean
    bonuses_along_route: boolean
    major_limit: number | null
    connection_bonuses: { from: (number | null)[]; to: (number | null)[]; ends_only: boolean }[]
    interconnections: { from: number[]; to: number[]; amount: number }[]
    allowed_stops: boolean[]
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
    budget_ms: number
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
