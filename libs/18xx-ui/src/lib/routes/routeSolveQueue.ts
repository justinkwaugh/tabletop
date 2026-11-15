import type { AutoroutingRequest, AutoroutingResponse } from '@tabletop/18xx-autorouter'

export type QueuedRouteWorker = Pick<
    Worker,
    'postMessage' | 'terminate' | 'addEventListener' | 'removeEventListener'
>

/** An answer on its way, which its asker may stop wanting. */
export type PendingRouteAnswer = {
    answer: Promise<AutoroutingResponse>
    cancel(): void
}

type Asked = {
    request: AutoroutingRequest
    settle(response: AutoroutingResponse): void
    settled: boolean
    /** Stops listening to the worker searching for this answer. */
    release?: () => void
}

const Cancelled: AutoroutingResponse = { error: 'The route calculation was cancelled.' }

// Every request is answered, in order, by one worker that is kept between them; a failed worker
// is replaced for the next. A search under way can only be stopped with its worker, so that is
// the one cancellation that costs a new worker.
export class RouteSolveQueue {
    private worker?: QueuedRouteWorker
    private readonly waiting: Asked[] = []
    private searching?: Asked
    constructor(private readonly createWorker: () => QueuedRouteWorker) {}

    solve(request: AutoroutingRequest): Promise<AutoroutingResponse> {
        return this.ask(request).answer
    }

    ask(request: AutoroutingRequest): PendingRouteAnswer {
        const asked: Asked = { request, settle: () => undefined, settled: false }
        const answer = new Promise<AutoroutingResponse>((resolve) => {
            asked.settle = resolve
        })
        this.waiting.push(asked)
        this.searchNext()
        return { answer, cancel: () => this.cancel(asked) }
    }

    warm() {
        try {
            this.running()
        } catch {
            // A worker that cannot start reports it to the first request that needs one.
        }
    }

    destroy() {
        this.worker?.terminate()
        this.worker = undefined
    }

    private cancel(asked: Asked) {
        if (asked.settled) return
        if (this.searching === asked) this.destroy()
        else this.waiting.splice(this.waiting.indexOf(asked), 1)
        this.finish(asked, Cancelled)
    }

    private finish(asked: Asked, response: AutoroutingResponse) {
        asked.release?.()
        asked.settled = true
        asked.settle(response)
        if (this.searching !== asked) return
        this.searching = undefined
        this.searchNext()
    }

    private searchNext() {
        if (this.searching) return
        const asked = this.waiting.shift()
        if (!asked) return
        this.searching = asked
        let worker: QueuedRouteWorker
        try {
            worker = this.running()
        } catch {
            this.finish(asked, { error: 'The route solver could not start.' })
            return
        }
        const answered = (event: MessageEvent<AutoroutingResponse>) => {
            this.finish(asked, event.data)
        }
        const failed = () => {
            if (this.worker === worker) this.destroy()
            this.finish(asked, { error: 'The route solver could not finish.' })
        }
        asked.release = () => {
            worker.removeEventListener('message', answered)
            worker.removeEventListener('error', failed)
        }
        worker.addEventListener('message', answered)
        worker.addEventListener('error', failed)
        try {
            worker.postMessage(asked.request)
        } catch {
            this.finish(asked, { error: 'The route solver could not take the position.' })
        }
    }

    private running(): QueuedRouteWorker {
        if (this.worker) return this.worker
        const worker = this.createWorker()
        // A worker that dies between requests has nobody listening, so the next one replaces it.
        worker.addEventListener('error', () => {
            if (this.worker === worker) this.destroy()
        })
        this.worker = worker
        return worker
    }
}
