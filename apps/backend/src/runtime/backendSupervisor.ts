import { BackendChild } from './backendChild.js'

export interface BackendTarget {
    port: number
    release: () => void
}

export interface SupervisorOptions {
    entry: URL
    startupTimeoutMs?: number
    drainTimeoutMs?: number
    retryDelayMs?: number
}

export class BackendSupervisor {
    private readonly children = new Set<BackendChild>()
    private starting?: BackendChild
    private active?: BackendChild
    private activePort?: number
    private replacement?: Promise<void>
    private reloadPending = false
    private stopping = false
    private retry?: NodeJS.Timeout

    constructor(private readonly options: SupervisorOptions) {}

    get port(): number | undefined {
        return this.activePort
    }

    acquire(): BackendTarget | undefined {
        if (!this.active || !this.activePort || this.stopping) return undefined
        return { port: this.activePort, release: this.active.retain() }
    }

    async start(): Promise<void> {
        await this.replace()
        if (!this.active) throw new Error('No backend is ready')
    }

    private requestReload(): void {
        if (this.stopping) return
        this.reloadPending = true
        if (!this.replacement && !this.retry) void this.replace()
    }

    private replace(): Promise<void> {
        if (this.replacement) return this.replacement
        this.reloadPending = false
        this.replacement = this.replaceChild()
            .catch((error: unknown) => {
                console.error('Backend replacement failed; retaining the serving child', error)
                this.reloadPending = true
                if (!this.stopping) {
                    this.retry = setTimeout(() => {
                        this.retry = undefined
                        void this.replace()
                    }, this.options.retryDelayMs ?? 30_000)
                }
            })
            .finally(() => {
                this.replacement = undefined
                if (this.reloadPending && !this.stopping && !this.retry) void this.replace()
            })
        return this.replacement
    }

    private async replaceChild(): Promise<void> {
        const previous = this.active
        const candidate = new BackendChild(
            this.options.entry,
            this.options.startupTimeoutMs ?? 120_000,
            () => {
                if (candidate === this.active || candidate === this.starting) this.requestReload()
            }
        )
        this.starting = candidate
        this.children.add(candidate)
        void candidate.exited.then(() => {
            this.children.delete(candidate)
            if (this.active === candidate) {
                this.active = undefined
                this.activePort = undefined
                this.requestReload()
            }
        })
        try {
            const port = await candidate.ready
            if (this.stopping) return
            this.starting = undefined
            this.active = candidate
            this.activePort = port
            console.log('Backend ready; routing requests to port', port)
            if (previous) await previous.stop(this.options.drainTimeoutMs ?? 30_000)
        } catch (error) {
            this.starting = undefined
            await candidate.stop(0)
            throw error
        }
    }

    async close(): Promise<void> {
        this.stopping = true
        clearTimeout(this.retry)
        this.activePort = undefined
        await Promise.all([...this.children].map((child) => child.stop(8_000)))
        await this.replacement
    }
}
