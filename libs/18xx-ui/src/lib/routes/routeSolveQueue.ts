import type { AutoroutingRequest, AutoroutingResponse } from '@tabletop/18xx-autorouter'
import type { RouteWorker } from './latestRouteSolver.js'

export type QueuedRouteWorker = RouteWorker & Pick<Worker, 'removeEventListener'>

// Every request is answered, in order, by one worker; a failed worker is replaced for the next.
export class RouteSolveQueue {
    private worker?: QueuedRouteWorker
    private queue: Promise<unknown> = Promise.resolve()
    constructor(private readonly createWorker: () => QueuedRouteWorker) {}

    solve(request: AutoroutingRequest): Promise<AutoroutingResponse> {
        const answer = this.queue.then(() => this.answer(request))
        this.queue = answer
        return answer
    }

    destroy() {
        this.worker?.terminate()
        this.worker = undefined
    }

    private answer(request: AutoroutingRequest): Promise<AutoroutingResponse> {
        return new Promise((resolve) => {
            let worker: QueuedRouteWorker
            try {
                worker = this.running()
            } catch {
                resolve({ error: 'The route solver could not start.' })
                return
            }
            const answered = (event: MessageEvent<AutoroutingResponse>) => {
                settle(event.data)
            }
            const failed = () => {
                if (this.worker === worker) this.destroy()
                settle({ error: 'The route solver could not finish.' })
            }
            const settle = (response: AutoroutingResponse) => {
                worker.removeEventListener('message', answered)
                worker.removeEventListener('error', failed)
                resolve(response)
            }
            worker.addEventListener('message', answered)
            worker.addEventListener('error', failed)
            worker.postMessage(request)
        })
    }

    private running(): QueuedRouteWorker {
        this.worker ??= this.createWorker()
        return this.worker
    }
}
