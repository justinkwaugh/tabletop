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

// Previews arrive faster than a worker can start, so one worker answers them all, one at a time,
// skipping any request a newer one replaced while it waited.
export class LatestRouteSolver<Request extends AutoroutingRequest> {
    private worker?: RouteWorker
    private inFlight?: Request
    private wanted?: Request
    constructor(
        private readonly createWorker: () => RouteWorker,
        private readonly events: SolverEvents<Request>
    ) {}

    solve(request: Request | undefined) {
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
        const solve: AutoroutingRequest = { state: request.state, companyId: request.companyId }
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
            this.inFlight = undefined
            if (request && response.result) this.events.solved(request, response.result)
            else if (request) this.events.failed(request)
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
        this.stop()
        if (request) this.events.failed(request)
    }

    private stop() {
        this.worker?.terminate()
        this.worker = undefined
        this.inFlight = undefined
    }
}
