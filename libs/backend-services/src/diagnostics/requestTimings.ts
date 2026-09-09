import { AsyncLocalStorage } from 'node:async_hooks'

interface TimingSpan {
    id: number
    parentId?: number
    name: string
    startMs: number
    durationMs: number
    status: 'ok' | 'error' | 'pending'
}

const context = new AsyncLocalStorage<{ timings: RequestTimings; parentId?: number }>()
const MAX_SPANS = 256

export class RequestTimings {
    private readonly startedAt = performance.now()
    private readonly spans: TimingSpan[] = []
    private readonly counters: Record<string, number> = {}
    private closed = false
    private droppedSpans = 0

    run<T>(operation: () => T): T {
        return context.run({ timings: this }, operation)
    }

    count(name: string, amount = 1): void {
        if (!this.closed) this.counters[name] = (this.counters[name] ?? 0) + amount
    }

    start(name: string, parentId?: number) {
        if (this.closed) return undefined
        if (this.spans.length >= MAX_SPANS) {
            this.droppedSpans++
            return undefined
        }
        const span: TimingSpan = {
            id: this.spans.length,
            ...(parentId === undefined ? {} : { parentId }),
            name,
            startMs: performance.now() - this.startedAt,
            durationMs: 0,
            status: 'pending'
        }
        this.spans.push(span)
        return {
            run: <T>(operation: () => T) =>
                context.run({ timings: this, parentId: span.id }, operation),
            end: (status: 'ok' | 'error' = 'ok') => {
                if (this.closed || span.status !== 'pending') return
                span.durationMs = performance.now() - this.startedAt - span.startMs
                span.status = status
            }
        }
    }

    finish() {
        this.closed = true
        const durationMs = performance.now() - this.startedAt
        return {
            durationMs: Math.round(durationMs * 100) / 100,
            counters: { ...this.counters },
            droppedSpans: this.droppedSpans,
            spans: this.spans.map((span) => ({
                ...span,
                startMs: Math.round(span.startMs * 100) / 100,
                durationMs:
                    Math.round(
                        (span.status === 'pending' ? durationMs - span.startMs : span.durationMs) *
                            100
                    ) / 100
            }))
        }
    }
}

export function countTiming(name: string, amount = 1): void {
    context.getStore()?.timings.count(name, amount)
}

export function startTiming(name: string) {
    const current = context.getStore()
    return current?.timings.start(name, current.parentId)
}

export async function measure<T>(name: string, operation: () => Promise<T>): Promise<T> {
    const span = startTiming(name)
    if (!span) return operation()
    try {
        const result = await span.run(operation)
        span.end()
        return result
    } catch (error) {
        span.end('error')
        throw error
    }
}

export function measureSync<T>(name: string, operation: () => T): T {
    const span = startTiming(name)
    if (!span) return operation()
    try {
        const result = span.run(operation)
        span.end()
        return result
    } catch (error) {
        span.end('error')
        throw error
    }
}

export function Timed(name: string) {
    return function <This, Args extends unknown[], Result>(
        _target: unknown,
        _property: string | symbol,
        descriptor: Pick<
            TypedPropertyDescriptor<(this: This, ...args: Args) => Promise<Result>>,
            'value'
        >
    ) {
        const method = descriptor.value
        if (!method) throw new Error('Timed requires a method')
        descriptor.value = function (this: This, ...args: Args) {
            return measure(name, () => method.apply(this, args))
        }
    }
}
