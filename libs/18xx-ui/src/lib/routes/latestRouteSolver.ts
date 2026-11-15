import type {
    AutoroutingRequest,
    AutoroutingResponse,
    AutoroutingResult
} from '@tabletop/18xx-autorouter'

export type RouteAnswers = { solve(request: AutoroutingRequest): Promise<AutoroutingResponse> }
export type RouteSolution = Pick<AutoroutingResult, 'result' | 'exhaustive'>
type SolverEvents<Request> = {
    solved: (request: Request, solution: RouteSolution) => void
    failed: (request: Request) => void
}

// How many recent answers are kept for requests that carry a key.
const RememberedSolutions = 64

// Previews arrive faster than they can be answered, so they are asked one at a time, skipping any
// request a newer one replaced while it waited. Requests with equal keys have the same answer (a
// route problem key), so a recent answer is reused without solving again.
export class LatestRouteSolver<Request extends AutoroutingRequest & { key?: string }> {
    private inFlight?: Request
    private wanted?: Request
    // A newer request was answered while the one in flight was solving, so its answer is only kept.
    private superseded = false
    private readonly solutions = new Map<string, RouteSolution>()
    constructor(
        private readonly answers: RouteAnswers,
        private readonly events: SolverEvents<Request>
    ) {}

    solve(request: Request | undefined) {
        const remembered = this.remembered(request)
        if (request && remembered) {
            this.wanted = undefined
            if (this.inFlight) this.superseded = true
            this.events.solved(request, remembered)
            return
        }
        this.wanted = request
        if (!this.inFlight) this.sendWanted()
    }

    destroy() {
        this.wanted = undefined
        this.inFlight = undefined
        this.superseded = false
    }

    private sendWanted() {
        const request = this.wanted
        this.wanted = undefined
        if (!request) return
        const { state, companyId, timeLimitMs } = request
        this.inFlight = request
        void this.answers
            .solve({ state, companyId, ...(timeLimitMs ? { timeLimitMs } : {}) })
            .then((response) => this.answered(request, response))
    }

    private answered(request: Request, response: AutoroutingResponse) {
        if (this.inFlight !== request) return
        const superseded = this.superseded
        this.inFlight = undefined
        this.superseded = false
        if (response.result) {
            this.remember(request, response.result)
            if (!superseded) this.events.solved(request, response.result)
        } else if (!superseded) this.events.failed(request)
        this.sendWanted()
    }

    private remembered(request: Request | undefined): RouteSolution | undefined {
        if (!request?.key) return undefined
        const solution = this.solutions.get(request.key)
        if (solution) {
            this.solutions.delete(request.key)
            this.solutions.set(request.key, solution)
        }
        return solution
    }

    private remember(request: Request, { result, exhaustive }: RouteSolution) {
        if (!request.key) return
        this.solutions.delete(request.key)
        this.solutions.set(request.key, { result, exhaustive })
        const oldest = this.solutions.keys().next()
        if (this.solutions.size > RememberedSolutions && !oldest.done)
            this.solutions.delete(oldest.value)
    }
}
