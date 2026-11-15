import { BackendChild } from './backendChild.js'

export interface BackendTarget {
    port: number
    release: () => void
}

export interface SupervisorOptions {
    entry: URL
    env?: NodeJS.ProcessEnv
    startupTimeoutMs?: number
    // How long close() lets the worker finish the requests it holds before killing it.
    drainTimeoutMs?: number
    retryDelayMs?: number
    // How long readiness vouches for a worker that announced it is loading game logic.
    titleLoadGraceMs?: number
}

// Starts the backend worker and starts another when it exits. Game logic changes are activated
// inside the worker (see LibraryService), so a healthy worker is never replaced.
export class BackendSupervisor {
    private readonly children = new Set<BackendChild>()
    private active?: BackendChild
    private activePort?: number
    private starting?: Promise<void>
    private startPending = false
    private stopping = false
    private retry?: NodeJS.Timeout
    private readonly readinessWaiters = new Set<() => void>()

    constructor(private readonly options: SupervisorOptions) {}

    get port(): number | undefined {
        return this.activePort
    }

    acquire(): BackendTarget | undefined {
        const serving = this.serving()
        if (!serving) return undefined
        return { port: serving.port, release: serving.child.retain() }
    }

    vouchingForTitleLoad(): boolean {
        const elapsed = this.serving()?.child.titleLoadElapsedMs()
        return elapsed !== undefined && elapsed < (this.options.titleLoadGraceMs ?? 30_000)
    }

    private serving(): { child: BackendChild; port: number } | undefined {
        if (!this.active || !this.activePort || this.stopping) return undefined
        return { child: this.active, port: this.activePort }
    }

    async acquireWhenReady(signal: AbortSignal): Promise<BackendTarget> {
        signal.throwIfAborted()
        const target = this.acquire()
        if (target) return target
        if (this.stopping) throw new Error('Backend is shutting down')
        if (this.readinessWaiters.size >= 500) throw new Error('Backend recovery queue is full')
        return new Promise((resolve, reject) => {
            const cleanup = () => {
                this.readinessWaiters.delete(check)
                signal.removeEventListener('abort', check)
            }
            const check = () => {
                if (signal.aborted || this.stopping) {
                    cleanup()
                    reject(new Error('Backend request canceled'))
                    return
                }
                const ready = this.acquire()
                if (ready) {
                    cleanup()
                    resolve(ready)
                }
            }
            this.readinessWaiters.add(check)
            signal.addEventListener('abort', check, { once: true })
            check()
        })
    }

    async start(): Promise<void> {
        await this.startChild()
        if (!this.active) throw new Error('No backend is ready')
    }

    private requestStart(): void {
        if (this.stopping) return
        this.startPending = true
        if (!this.starting && !this.retry) void this.startChild()
    }

    private startChild(): Promise<void> {
        if (this.starting) return this.starting
        this.startPending = false
        this.starting = this.spawnChild()
            .catch((error: unknown) => {
                console.error('Backend start failed; retrying', error)
                this.startPending = true
                if (!this.stopping) {
                    this.retry = setTimeout(() => {
                        this.retry = undefined
                        void this.startChild()
                    }, this.options.retryDelayMs ?? 30_000)
                }
            })
            .finally(() => {
                this.starting = undefined
                if (this.startPending && !this.stopping && !this.retry) void this.startChild()
            })
        return this.starting
    }

    private async spawnChild(): Promise<void> {
        const candidate = new BackendChild(
            this.options.entry,
            this.options.startupTimeoutMs ?? 120_000,
            this.options.env
        )
        this.children.add(candidate)
        void candidate.exited.then(() => {
            this.children.delete(candidate)
            if (this.active === candidate) {
                this.active = undefined
                this.activePort = undefined
                this.requestStart()
            }
        })
        try {
            const port = await candidate.ready
            if (this.stopping) return
            this.active = candidate
            this.activePort = port
            for (const check of this.readinessWaiters) check()
            console.log('Backend ready; routing requests to port', port)
        } catch (error) {
            await candidate.stop(0)
            throw error
        }
    }

    async close(): Promise<void> {
        this.stopping = true
        clearTimeout(this.retry)
        this.activePort = undefined
        for (const check of this.readinessWaiters) check()
        const drainTimeoutMs = this.options.drainTimeoutMs ?? 8_000
        await Promise.all([...this.children].map((child) => child.stop(drainTimeoutMs)))
        await this.starting
    }
}
