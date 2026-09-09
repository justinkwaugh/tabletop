import { BaseTaskService } from './baseTaskService.js'
import { CreatePushTaskOptions } from './taskService.js'

export class LocalTaskService extends BaseTaskService {
    private readonly timers = new Set<ReturnType<typeof setTimeout>>()
    private closed = false

    constructor(private readonly host: string) {
        super()
    }

    close(): void {
        this.closed = true
        for (const timer of this.timers) clearTimeout(timer)
        this.timers.clear()
    }

    async createPushTask<T>(options: CreatePushTaskOptions<T>): Promise<void> {
        if (this.closed) throw new Error('Local task service is closed')
        this.schedule(options, Math.max(0, options.inSeconds ?? 0) * 1000)
    }

    private schedule<T>(options: CreatePushTaskOptions<T>, delay: number): void {
        if (this.closed) return
        const timer = setTimeout(
            () => {
                this.timers.delete(timer)
                if (delay > 2_147_483_647) this.schedule(options, delay - 2_147_483_647)
                else void this.deliver(options)
            },
            Math.min(delay, 2_147_483_647)
        )
        timer.unref()
        this.timers.add(timer)
    }

    private async deliver<T>(options: CreatePushTaskOptions<T>): Promise<void> {
        try {
            const response = await fetch(`${this.host}/tasks${options.path}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(options.payload),
                signal: AbortSignal.timeout(120_000)
            })
            if (!response.ok)
                throw new Error(`Local task ${options.path} returned ${response.status}`)
        } catch (error) {
            console.error('Local task will retry', error)
            this.schedule(options, 30_000)
        }
    }
}
