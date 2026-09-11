import * as Type from 'typebox'

export type SolverStop = {
    token: boolean
    blocked: boolean
    city: boolean
    endpoint: boolean
    allowed: boolean
    groups: number[]
}
export type SolverArc = {
    from: number | null
    to: number | null
    next: number[]
    resources: number[]
    path: number
    hex: number
    terminal: boolean
    crossings: number
}
export type SolverTrain = {
    id: string
    distance: number
    counts_crossings: boolean
    requires_city: boolean
    visit_costs: number[]
    revenues: number[]
    first_bonus: number[]
}
export type SolverProblem = {
    version: number
    stops: SolverStop[]
    arcs: SolverArc[]
    trains: SolverTrain[]
    resource_count: number
    group_count: number
    hex_bonuses: number[]
    budget_ms: number
}
const Index = Type.Integer({ minimum: 0 })
const Time = Type.Number({ minimum: 0 })
export const SolverSolution = Type.Object({
    revenue: Index,
    routes: Type.Array(
        Type.Object({
            train: Index,
            connections: Type.Array(
                Type.Object({ from: Index, to: Index, paths: Type.Array(Index) })
            )
        })
    ),
    exhaustive: Type.Boolean(),
    path_exhaustive: Type.Boolean(),
    combination_exhaustive: Type.Boolean(),
    candidates: Type.Array(Index),
    expansions: Index,
    connections: Index,
    compile_ms: Time,
    path_ms: Time,
    combination_ms: Time
})
export type SolverSolution = Type.Static<typeof SolverSolution>
export const SolverError = Type.Object({ error: Type.String() })
