import type {
    AutoroutingRequest,
    AutoroutingResponse,
    AutoroutingResult
} from '@tabletop/18xx-autorouter'

export type RouteWorker = Pick<Worker, 'postMessage' | 'terminate' | 'addEventListener'>
export type RouteSolution = Pick<AutoroutingResult, 'result' | 'exhaustive'>
type SolverEvents<Request> = {
    solved: (request: Request, solution: RouteSolution) => void
    failed: (request: Request) => void
}

// How many recent answers are kept for requests that carry a key.
const RememberedSolutions = 64

// Previews arrive faster than a worker can start, so one worker answers them all, one at a time,
// skipping any request a newer one replaced while it waited. Requests with equal keys have the
// same answer (a route problem key), so a recent answer is reused without solving again.
export class LatestRouteSolver<Request extends AutoroutingRequest & { key?: string }> {
    private worker?: RouteWorker
    private inFlight?: Request
    private wanted?: Request
    // A newer request was answered while the one in flight was solving, so its answer is only kept.
    private superseded = false
    private readonly solutions = new Map<string, RouteSolution>()
    constructor(
        private readonly createWorker: () => RouteWorker,
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
        this.stop()
    }

    private sendWanted() {
        const request = this.wanted
        this.wanted = undefined
        if (!request) return
        const { state, companyId, timeLimitMs } = request
        const solve: AutoroutingRequest = {
            state,
            companyId,
            ...(timeLimitMs ? { timeLimitMs } : {})
        }
        this.inFlight = request
        try {
            this.running().postMessage(solve)
        } catch {
            this.fail()
        }
    }

    private running(): RouteWorker {
        if (this.worker) return this.worker
        const worker = this.createWorker()
        worker.addEventListener('message', (event) => {
            if (worker !== this.worker) return
            const response: AutoroutingResponse = event.data
            const request = this.inFlight
            const superseded = this.superseded
            this.inFlight = undefined
            this.superseded = false
            if (request && response.result) {
                this.remember(request, response.result)
                if (!superseded) this.events.solved(request, response.result)
            } else if (request && !superseded) this.events.failed(request)
            this.sendWanted()
        })
        worker.addEventListener('error', () => {
            if (worker !== this.worker) return
            this.fail()
            this.sendWanted()
        })
        this.worker = worker
        return worker
    }

    private fail() {
        const request = this.inFlight
        const superseded = this.superseded
        this.stop()
        if (request && !superseded) this.events.failed(request)
    }

    private stop() {
        this.worker?.terminate()
        this.worker = undefined
        this.inFlight = undefined
        this.superseded = false
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
