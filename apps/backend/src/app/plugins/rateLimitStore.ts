import type { FastifyRateLimitStore, FastifyRateLimitStoreCtor } from '@fastify/rate-limit'
import type { RateLimitCounter } from '@tabletop/backend-services/rate-limit-counter'

type IncrCallback = (error: Error | null, result?: { current: number; ttl: number }) => void

const defaultWindowMs = 60_000

// The plugin hands child() its merged limiter params, whose routeInfo names the route for a
// route-level limiter and is empty for one made with createRateLimit; those share the plugin
// scope, so their key generators must emit a namespaced key themselves.
function routeScope(params: object): string {
    if (!('routeInfo' in params)) return ''
    const { routeInfo } = params
    if (typeof routeInfo !== 'object' || routeInfo === null) return ''
    if (!('url' in routeInfo) || typeof routeInfo.url !== 'string') return ''
    const method = 'method' in routeInfo ? routeInfo.method : undefined
    const methods = Array.isArray(method) ? method : [method]
    return `${methods.map(String).join('|')}:${routeInfo.url}:`
}

class RateLimitCounterStore implements FastifyRateLimitStore {
    constructor(
        private readonly counter: RateLimitCounter,
        private readonly scope: string
    ) {}

    incr(key: string, callback: IncrCallback, timeWindow = defaultWindowMs): void {
        this.counter.increment(`${this.scope}${key}`, timeWindow).then(
            (window) => callback(null, { current: window.current, ttl: window.ttlMs }),
            (error: unknown) => callback(error instanceof Error ? error : new Error(String(error)))
        )
    }

    child(params: object): RateLimitCounterStore {
        return new RateLimitCounterStore(this.counter, `${this.scope}${routeScope(params)}`)
    }
}

export function rateLimitCounterStore(
    counter: RateLimitCounter,
    scope: string
): FastifyRateLimitStoreCtor {
    return class extends RateLimitCounterStore {
        constructor() {
            super(counter, scope)
        }
    }
}
