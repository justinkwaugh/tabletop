import type { FastifyInstance, FastifyRequest } from 'fastify'
import { RequestTimings } from '@tabletop/backend-services/diagnostics'
import { assertExists } from '@tabletop/common'

export type RequestTrace = ReturnType<RequestTimings['finish']>

export function traceRequests(server: FastifyInstance): () => RequestTrace {
    const pending = new WeakMap<FastifyRequest, RequestTimings>()
    let latest: RequestTrace | undefined
    server.addHook('onRequest', (request, _reply, done) => {
        const timings = new RequestTimings()
        pending.set(request, timings)
        timings.run(done)
    })
    server.addHook('onResponse', async (request) => {
        const timings = pending.get(request)
        if (!timings) return
        pending.delete(request)
        latest = timings.finish()
    })
    return () => {
        assertExists(latest, 'a traced request')
        return latest
    }
}

export function spanCount(trace: RequestTrace, name: string): number {
    return trace.spans.filter((span) => span.name === name).length
}
