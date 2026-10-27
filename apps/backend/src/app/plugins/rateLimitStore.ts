import type { FastifyRateLimitStore, FastifyRateLimitStoreCtor } from '@fastify/rate-limit'
import type { WindowCounter } from '@tabletop/backend-services/window-counter'

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

class WindowCounterStore implements FastifyRateLimitStore {
    constructor(
        private readonly counter: WindowCounter,
        private readonly scope: string
    ) {}

    incr(key: string, callback: IncrCallback, timeWindow = defaultWindowMs): void {
        this.counter.count(`${this.scope}${key}`, timeWindow).then(
            (window) => callback(null, { current: window.current, ttl: window.ttlMs }),
            (error: unknown) => callback(error instanceof Error ? error : new Error(String(error)))
        )
    }

    child(params: object): WindowCounterStore {
        return new WindowCounterStore(this.counter, `${this.scope}${routeScope(params)}`)
    }
}

export function windowCounterStore(
    counter: WindowCounter,
    scope: string
): FastifyRateLimitStoreCtor {
    return class extends WindowCounterStore {
        constructor() {
            super(counter, scope)
        }
    }
}
