import { assert, assertExists } from '@tabletop/common'
import {
    RouteEvaluation,
    type OperatingResult,
    type RouteRules,
    type TrainRunningState
} from '@tabletop/18xx'
import { Compile } from 'typebox/compile'
import { EncodedRoutes } from './encodedRoutes.js'
import { SolverError, SolverSolution, type SolverProblem } from './solverProtocol.js'

export type AutoroutingOptions = { timeLimitMs?: number }
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
        candidates: number[]
        expansions: number
        connections: number
    }
}

export class Autorouter {
    private static readonly solutionValidator = Compile(SolverSolution)
    private static readonly errorValidator = Compile(SolverError)
    private readonly memory: WebAssembly.Memory

    private constructor(private readonly exports: WebAssembly.Exports) {
        assert(exports.memory instanceof WebAssembly.Memory, 'Solver requires WebAssembly memory')
        this.memory = exports.memory
        for (const name of ['allocate', 'solve', 'release'])
            assert(typeof exports[name] === 'function', `Solver is missing ${name}`)
    }

    static async create(bytes: BufferSource | WebAssembly.Module): Promise<Autorouter> {
        const module =
            bytes instanceof WebAssembly.Module ? bytes : await WebAssembly.compile(bytes)
        const instance = new WebAssembly.Instance(module, {
            clock: { now: () => performance.now() }
        })
        return new Autorouter(instance.exports)
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
        const started = performance.now()
        const evaluation = new RouteEvaluation(state, rules)
        const available = evaluation.evaluate(companyId, [])
        assertExists(available.result, available.reason ?? 'Company cannot run trains')
        const encoded = new EncodedRoutes(state, rules, companyId, evaluation.network, timeLimitMs)
        const encodeMs = performance.now() - started
        const searchStarted = performance.now()
        const solution = this.solveEncoded(encoded.problem)
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
                candidates: solution.candidates,
                expansions: solution.expansions,
                connections: solution.connections
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
