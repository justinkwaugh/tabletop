import { addToChecksum, assert, assertExists } from '@tabletop/common'
import {
    RouteEvaluation,
    atRunningStep,
    routesBetween,
    type OperatingResult,
    type RevenueCenter,
    type RouteRules,
    type TrainRoute,
    type TrainRunningState
} from '@tabletop/18xx'
import { Compile } from 'typebox/compile'
import { EncodedRoutes } from './encodedRoutes.js'
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
        const requiredEnds = rules.requiredRouteEnds?.(state, companyId)
        if (requiredEnds)
            return this.solveRequired(state, rules, companyId, requiredEnds, timeLimitMs)
        const started = performance.now()
        const evaluation = new RouteEvaluation(state, rules)
        const available = evaluation.evaluate(companyId, [])
        assertExists(available.result, available.reason ?? 'Company cannot run trains')
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
            checked.result.revenue === solution.revenue,
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
