import { addToChecksum, assert, assertExists } from '@tabletop/common'
import {
    RouteEvaluation,
    atRunningStep,
    companyStationCenters,
    routesBetween,
    type OperatingResult,
    type RevenueCenter,
    type RoutePath,
    type RouteRules,
    type TrainRoute,
    type TrainRunningState
} from '@tabletop/18xx'
import { Compile } from 'typebox/compile'
import { EncodedRoutes, type EncodedTrain } from './encodedRoutes.js'
import { SolverError, SolverSolution, type SolverProblem } from './solverProtocol.js'

export type AutoroutingOptions = { timeLimitMs?: number }

// What the solver may hold in track paths, candidate routes and the tables that combine them. With
// the rest of a solve this stays within the instance's 64 MiB maximum, set when it is built.
const SolverMemoryBudgetBytes = 40 * 2 ** 20
// WebAssembly memory never shrinks, so an instance that grew past this is replaced after its solve
// rather than holding the memory until the next one.
const InstanceMemoryReleaseBytes = 32 * 2 ** 20
// More routes between one pair of stops than a run is worth trying; the search reports the cut.
const RequiredRouteLimit = 2000
// More runs from its stations than a station-run train is worth trying; the search reports the cut.
const StationRunLimit = 500

/** A run a station-run train may make from one of its company's stations, and the track it uses. */
type StationRun = {
    route: TrainRoute
    revenue: number
    resources: readonly string[]
    station: string
}
type FleetSearch = {
    state: TrainRunningState
    rules: RouteRules
    companyId: string
    evaluation: RouteEvaluation
    deadline: number
}
type FleetAnswer = {
    routes: TrainRoute[]
    /** What the searches valued the routes at, each train earning its once-a-run bonuses. */
    searched: number
    exhaustive: boolean
}
type SearchMetrics = Pick<
    AutoroutingResult['metrics'],
    | 'compileMs'
    | 'pathMs'
    | 'combinationMs'
    | 'pathExhaustive'
    | 'combinationExhaustive'
    | 'memoryLimited'
    | 'candidates'
    | 'expansions'
    | 'connections'
>
export type AutoroutingResult = {
    result: OperatingResult
    exhaustive: boolean
    metrics: {
        encodeMs: number
        solveMs: number
        validateMs: number
        compileMs: number
        pathMs: number
        combinationMs: number
        pathExhaustive: boolean
        combinationExhaustive: boolean
        /** The solver reached its memory budget and kept only its most valuable candidates. */
        memoryLimited: boolean
        /** The solver instance's memory after the solve. */
        memoryBytes: number
        candidates: number[]
        expansions: number
        connections: number
    }
}

/** Equal keys have the same best run: they hash everything the company's routes can reach. */
export function routeProblemKey(
    state: TrainRunningState,
    rules: RouteRules,
    companyId: string
): string {
    const running = atRunningStep(state, companyId)
    const { network } = new RouteEvaluation(running, rules)
    const encoded = new EncodedRoutes(running, rules, companyId, network, {
        timeLimitMs: 1,
        memoryBudgetBytes: SolverMemoryBudgetBytes
    })
    return addToChecksum(0, [encoded.networkKey()]).toString(36)
}

export class Autorouter {
    private static readonly solutionValidator = Compile(SolverSolution)
    private static readonly errorValidator = Compile(SolverError)
    private exports!: WebAssembly.Exports
    private memory!: WebAssembly.Memory

    private constructor(private readonly module: WebAssembly.Module) {
        this.instantiate()
    }

    static async create(bytes: BufferSource | WebAssembly.Module): Promise<Autorouter> {
        return new Autorouter(
            bytes instanceof WebAssembly.Module ? bytes : await WebAssembly.compile(bytes)
        )
    }

    // A fresh instance releases the old one's memory; one that trapped cannot be used again.
    private instantiate() {
        const { exports } = new WebAssembly.Instance(this.module, {
            clock: { now: () => performance.now() }
        })
        assert(exports.memory instanceof WebAssembly.Memory, 'Solver requires WebAssembly memory')
        for (const name of ['allocate', 'solve', 'release'])
            assert(typeof exports[name] === 'function', `Solver is missing ${name}`)
        this.exports = exports
        this.memory = exports.memory
    }

    solve(
        state: TrainRunningState,
        rules: RouteRules,
        companyId: string,
        options: AutoroutingOptions = {}
    ): AutoroutingResult {
        const timeLimitMs = options.timeLimitMs ?? 30_000
        assert(
            Number.isFinite(timeLimitMs) && timeLimitMs > 0,
            'Routing time limit must be positive'
        )
        assert(!rules.routeAllowed, 'Native route shapes must be declared as policy')
        const requiredEnds = rules.requiredRouteEnds?.(state, companyId)
        assert(
            !(rules.fleet && requiredEnds),
            'Fleet policy cannot combine with required-route enumeration'
        )
        if (requiredEnds)
            return this.solveRequired(state, rules, companyId, requiredEnds, timeLimitMs)
        const started = performance.now()
        const evaluation = new RouteEvaluation(state, rules)
        const available = evaluation.evaluate(companyId, [])
        assertExists(available.result, available.reason ?? 'Company cannot run trains')
        const fleet = { state, rules, companyId, evaluation }
        if (this.routesApart(fleet))
            return this.solveApart({ ...fleet, deadline: started + timeLimitMs })
        const encoded = new EncodedRoutes(state, rules, companyId, evaluation.network, {
            timeLimitMs,
            memoryBudgetBytes: SolverMemoryBudgetBytes
        })
        const encodeMs = performance.now() - started
        const searchStarted = performance.now()
        let solution: SolverSolution
        try {
            solution = this.solveEncoded(encoded.problem)
        } catch (error) {
            this.instantiate()
            throw error
        }
        const memoryBytes = this.memory.buffer.byteLength
        if (memoryBytes > InstanceMemoryReleaseBytes) this.instantiate()
        const solveMs = performance.now() - searchStarted
        const validationStarted = performance.now()
        const checked = evaluation.evaluate(companyId, encoded.decode(solution))
        assertExists(checked.result, checked.reason ?? 'Solver returned an invalid operation')
        assert(
            checked.result.revenue === solution.revenue &&
                (rules.runSubsidy !== undefined ||
                    (checked.result.subsidy ?? 0) === solution.subsidy),
            'Solver and game disagree on route revenue'
        )
        return {
            result: checked.result,
            exhaustive: solution.exhaustive,
            metrics: {
                encodeMs,
                solveMs,
                validateMs: performance.now() - validationStarted,
                compileMs: solution.compile_ms,
                pathMs: solution.path_ms,
                combinationMs: solution.combination_ms,
                pathExhaustive: solution.path_exhaustive,
                combinationExhaustive: solution.combination_exhaustive,
                memoryLimited: solution.memory_limited,
                memoryBytes,
                candidates: solution.candidates,
                expansions: solution.expansions,
                connections: solution.connections
            }
        }
    }

    /**
     * Whether some of the company's trains are routed in searches of their own: station-run
     * trains, trains that share track, attached rolling stock, or a bonus one route of the run
     * earns.
     */
    private routesApart({
        state,
        rules,
        companyId,
        evaluation
    }: Omit<FleetSearch, 'deadline'>): boolean {
        if (evaluation.attachments(companyId).length) return true
        return evaluation.runnableTrains(companyId).some((train) => {
            const definition = rules.depot.trainDefinition(train.definitionId)
            return (
                definition.sharesTrack ||
                definition.distance.stationRun ||
                rules
                    .revenuePolicy?.(definition, state, companyId)
                    .connectionBonuses?.some((bonus) => bonus.oncePerRun)
            )
        })
    }

    /**
     * The best run of a fleet whose trains are not all routed together. Each way of attaching the
     * company's rolling stock is tried. Trains sharing track are routed alone, as nothing they use
     * is closed to the others. Station-run trains' few runs are listed and the rest of the fleet
     * routed beside each choice of them that could beat the best so far. A bonus one route earns
     * is first given to every train; if more than one route then earns it, each train in turn is
     * routed as its only earner.
     */
    private solveApart(search: FleetSearch): AutoroutingResult {
        assert(!search.rules.fleet, 'Fleet policy cannot combine with trains routed apart')
        const started = performance.now()
        const { evaluation, companyId } = search
        const metrics: SearchMetrics = {
            compileMs: 0,
            pathMs: 0,
            combinationMs: 0,
            pathExhaustive: true,
            combinationExhaustive: true,
            memoryLimited: false,
            candidates: [],
            expansions: 0,
            connections: 0
        }
        let best: OperatingResult | undefined
        let exhaustive = true
        const consider = (answer: FleetAnswer): OperatingResult => {
            const checked = evaluation.evaluate(companyId, answer.routes)
            assertExists(checked.result, checked.reason ?? 'Solver returned an invalid operation')
            exhaustive &&= answer.exhaustive
            if (!best || checked.result.revenue > best.revenue) best = checked.result
            return checked.result
        }
        for (const fleet of this.attachedFleets(search)) {
            const answer = this.solveFleet(search, fleet, metrics)
            if (consider(answer).revenue === answer.searched) continue
            for (const earner of [...fleet.map(({ train }) => train.id), undefined])
                consider(
                    this.solveFleet(
                        search,
                        fleet.map((entry) =>
                            entry.train.id === earner
                                ? entry
                                : { ...entry, withoutOncePerRun: true as const }
                        ),
                        metrics
                    )
                )
        }
        assertExists(best, 'A company that may run has a fleet to route')
        const memoryBytes = this.memory.buffer.byteLength
        if (memoryBytes > InstanceMemoryReleaseBytes) this.instantiate()
        return {
            result: best,
            exhaustive,
            metrics: {
                encodeMs: 0,
                solveMs: performance.now() - started,
                validateMs: 0,
                ...metrics,
                memoryBytes
            }
        }
    }

    /** Each distinct way of attaching the company's rolling stock to its trains, or leaving it off. */
    private attachedFleets({ evaluation, rules, companyId }: FleetSearch): EncodedTrain[][] {
        const trains = evaluation.runnableTrains(companyId)
        const attachments = evaluation.attachments(companyId)
        const fleets = new Map<string, EncodedTrain[]>()
        const assign = (index: number, attached: ReadonlyMap<string, readonly string[]>): void => {
            const attachment = attachments[index]
            if (!attachment) {
                const fleet = trains.flatMap((train): EncodedTrain[] => {
                    const attachmentIds = attached.get(train.id) ?? []
                    const running = evaluation.runningDefinition(companyId, train, attachmentIds)
                    return running.definition
                        ? [
                              {
                                  train,
                                  definition: running.definition,
                                  ...(attachmentIds.length ? { attachmentIds } : {})
                              }
                          ]
                        : []
                })
                if (fleet.length !== trains.length) return
                const key = fleet
                    .map(({ train, attachmentIds = [] }) =>
                        [
                            train.definitionId,
                            ...attachmentIds.map(
                                (id) => attachments.find((entry) => entry.id === id)?.definitionId
                            )
                        ].join('+')
                    )
                    .sort()
                    .join(' ')
                if (!fleets.has(key)) fleets.set(key, fleet)
                return
            }
            assign(index + 1, attached)
            for (const train of trains) {
                if (rules.depot.trainDefinition(train.definitionId).attachment) continue
                assign(
                    index + 1,
                    new Map([
                        ...attached,
                        [train.id, [...(attached.get(train.id) ?? []), attachment.id]]
                    ])
                )
            }
        }
        assign(0, new Map())
        return [...fleets.values()]
    }

    private solveFleet(
        search: FleetSearch,
        fleet: readonly EncodedTrain[],
        metrics: SearchMetrics
    ): FleetAnswer {
        const { state, rules, companyId, evaluation, deadline } = search
        const routes: TrainRoute[] = []
        let searched = 0
        let exhaustive = true
        const encode = (trains: readonly EncodedTrain[]) =>
            new EncodedRoutes(state, rules, companyId, evaluation.network, {
                timeLimitMs: Math.max(1, deadline - performance.now()),
                memoryBudgetBytes: SolverMemoryBudgetBytes,
                fleet: trains
            })
        const run = (problem: SolverProblem): SolverSolution => {
            let solution: SolverSolution
            try {
                solution = this.solveEncoded({
                    ...problem,
                    budget_ms: Math.max(1, deadline - performance.now())
                })
            } catch (error) {
                this.instantiate()
                throw error
            }
            exhaustive &&= solution.exhaustive
            metrics.compileMs += solution.compile_ms
            metrics.pathMs += solution.path_ms
            metrics.combinationMs += solution.combination_ms
            metrics.pathExhaustive &&= solution.path_exhaustive
            metrics.combinationExhaustive &&= solution.combination_exhaustive
            metrics.memoryLimited ||= solution.memory_limited
            metrics.candidates = [...metrics.candidates, ...solution.candidates]
            metrics.expansions += solution.expansions
            metrics.connections += solution.connections
            return solution
        }
        const sharing = fleet.filter(({ definition }) => definition.sharesTrack)
        const stationed = fleet.filter(
            ({ definition }) => !definition.sharesTrack && definition.distance.stationRun
        )
        const others = fleet.filter(
            ({ definition }) => !definition.sharesTrack && !definition.distance.stationRun
        )
        for (const train of sharing) {
            const encoded = encode([train])
            const solution = run(encoded.problem)
            routes.push(...encoded.decode(solution))
            searched += solution.revenue
        }
        const encoded = others.length ? encode(others) : undefined
        const open = encoded && run(encoded.problem)
        const openRevenue = open?.revenue ?? 0
        const runs = stationed.map((train) => {
            const found = this.stationRuns(search, train)
            exhaustive &&= found.exhausted
            return found.runs
        })
        const choices = this.stationChoices(runs)
        let chosen: { value: number; routes: TrainRoute[] } | undefined
        for (const choice of choices) {
            const bound = choice.revenue + openRevenue
            if (chosen && bound <= chosen.value) break
            if (!encoded || !open || !choice.resources.length) {
                chosen = {
                    value: bound,
                    routes: [...choice.routes, ...(encoded && open ? encoded.decode(open) : [])]
                }
                continue
            }
            const beside = encoded.without(choice.resources)
            const solution = run(beside.problem)
            const value = choice.revenue + solution.revenue
            if (!chosen || value > chosen.value)
                chosen = { value, routes: [...choice.routes, ...beside.decode(solution)] }
        }
        assertExists(chosen, 'Station-run trains may always stay idle')
        return {
            routes: [...routes, ...chosen.routes],
            searched: searched + chosen.value,
            exhaustive
        }
    }

    /**
     * Every way of choosing a run, or none, for each station-run train, no two from the same station
     * or on the same track, the most valuable first.
     */
    private stationChoices(
        runs: readonly (readonly StationRun[])[]
    ): { revenue: number; routes: TrainRoute[]; resources: string[] }[] {
        const choices: { revenue: number; routes: TrainRoute[]; resources: string[] }[] = []
        const choose = (index: number, chosen: readonly StationRun[]): void => {
            const options = runs[index]
            if (!options) {
                choices.push({
                    revenue: chosen.reduce((sum, run) => sum + run.revenue, 0),
                    routes: chosen.map((run) => run.route),
                    resources: chosen.flatMap((run) => run.resources)
                })
                return
            }
            choose(index + 1, chosen)
            for (const option of options) {
                if (
                    chosen.some(
                        (run) =>
                            run.station === option.station ||
                            run.resources.some((key) => option.resources.includes(key))
                    )
                )
                    continue
                choose(index + 1, [...chosen, option])
            }
        }
        choose(0, [])
        return choices.sort((a, b) => b.revenue - a.revenue)
    }
    /**
     * Every run a station-run train may make from one of its company's stations: there alone, or
     * out along track for as long as the train's distance allows.
     */
    private stationRuns(
        { state, companyId, evaluation }: FleetSearch,
        { train, attachmentIds }: EncodedTrain
    ): { runs: StationRun[]; exhausted: boolean } {
        const runs: StationRun[] = []
        let exhausted = true
        const attached = attachmentIds?.length ? { attachmentIds: [...attachmentIds] } : {}
        const offer = (start: RevenueCenter, paths: readonly RoutePath[]): boolean => {
            const route: TrainRoute = { trainId: train.id, start, paths: [...paths], ...attached }
            const complete = evaluation.evaluateFleetRoute(companyId, route)
            if (complete.route) {
                if (runs.length >= StationRunLimit) {
                    exhausted = false
                    return false
                }
                runs.push({
                    route,
                    revenue: complete.route.result.revenue,
                    resources: complete.resources,
                    station: JSON.stringify([start.locationId, start.nodeId])
                })
            }
            return true
        }
        for (const start of companyStationCenters(state, companyId)) {
            if (!offer(start, [])) break
            evaluation.network.walk(start, {}, (walk, atStop) => {
                const within = !evaluation.evaluateRoute(
                    companyId,
                    { trainId: train.id, start, paths: [...walk.paths], ...attached },
                    false
                ).reason
                if (!within) return false
                return atStop ? offer(start, walk.paths) : true
            })
        }
        return { runs, exhausted }
    }

    private solveRequired(
        state: TrainRunningState,
        rules: RouteRules,
        companyId: string,
        [from, to]: readonly RevenueCenter[],
        timeLimitMs: number
    ): AutoroutingResult {
        const started = performance.now()
        const deadline = started + timeLimitMs
        const evaluation = new RouteEvaluation(state, rules)
        const { network } = evaluation
        const encoded = new EncodedRoutes(state, rules, companyId, network, {
            timeLimitMs,
            memoryBudgetBytes: SolverMemoryBudgetBytes
        })
        const trains = evaluation.runnableTrains(companyId)
        const profiles = new Map(trains.map((train) => [train.definitionId, train]))
        const stopAllowed = (center: RevenueCenter) =>
            rules.stopAllowed?.(state, companyId, center) !== false
        let best: OperatingResult | undefined
        let exhaustive = true
        let solves = 0
        const encodeMs = performance.now() - started
        for (const train of profiles.values()) {
            const { maximum } = rules.depot.trainDefinition(train.definitionId).distance
            const found = routesBetween(
                network,
                state,
                companyId,
                from,
                to,
                maximum === 'unlimited' ? Infinity : maximum,
                { stopAllowed, limit: RequiredRouteLimit }
            )
            exhaustive &&= found.exhausted
            for (const paths of found.routes) {
                if (performance.now() > deadline) {
                    exhaustive = false
                    break
                }
                const route = { trainId: train.id, start: { ...from }, paths }
                const trace = network.trace(route.start, paths).trace
                if (!trace) continue
                const rest = encoded.beside(train.id, trace.resources)
                let others: TrainRoute[] = []
                if (rest.problem.trains.length) {
                    const solution = this.solveEncoded({
                        ...rest.problem,
                        budget_ms: Math.max(1, deadline - performance.now())
                    })
                    solves++
                    exhaustive &&= solution.exhaustive
                    others = rest.decode(solution)
                }
                const result = evaluation.evaluate(companyId, [route, ...others]).result
                if (result && (!best || result.revenue > best.revenue)) best = result
            }
        }
        assertExists(best, 'A company making this run has a route between the stops')
        if (this.memory.buffer.byteLength > InstanceMemoryReleaseBytes) this.instantiate()
        const solveMs = performance.now() - started - encodeMs
        return {
            result: best,
            exhaustive,
            metrics: {
                encodeMs,
                solveMs,
                validateMs: 0,
                compileMs: 0,
                pathMs: 0,
                combinationMs: 0,
                pathExhaustive: exhaustive,
                combinationExhaustive: exhaustive,
                memoryLimited: false,
                memoryBytes: this.memory.buffer.byteLength,
                candidates: [],
                expansions: solves,
                connections: 0
            }
        }
    }

    private solveEncoded(problem: SolverProblem): SolverSolution {
        const input = new TextEncoder().encode(JSON.stringify(problem))
        const pointer = this.call('allocate', input.length)
        assert(typeof pointer === 'number', 'Solver returned an invalid allocation')
        let outputPointer: number | undefined
        let outputLength = 0
        try {
            new Uint8Array(this.memory.buffer, pointer, input.length).set(input)
            const packed = this.call('solve', pointer, input.length)
            assert(typeof packed === 'bigint', 'Solver returned an invalid buffer')
            outputPointer = Number(packed & 0xffffffffn)
            outputLength = Number(packed >> 32n)
            const result: unknown = JSON.parse(
                new TextDecoder().decode(
                    new Uint8Array(this.memory.buffer, outputPointer, outputLength)
                )
            )
            if (Autorouter.errorValidator.Check(result)) throw new Error(result.error)
            assert(Autorouter.solutionValidator.Check(result), 'Solver returned an invalid result')
            return result
        } finally {
            this.call('release', pointer, input.length)
            if (outputPointer !== undefined) this.call('release', outputPointer, outputLength)
        }
    }

    private call(name: string, ...args: number[]): unknown {
        const method = this.exports[name]
        assert(typeof method === 'function', `Solver is missing ${name}`)
        return method(...args)
    }
}
