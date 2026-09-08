import fp from 'fastify-plugin'
import type { FastifyRequest } from 'fastify'
import { RequestTimings } from '@tabletop/backend-services/diagnostics'

declare module 'fastify' {
    interface FastifyContextConfig {
        requestTiming?: boolean
    }
}

export default fp<{ enabled?: boolean; projectId?: string }>(async (fastify, options) => {
    if (!(options.enabled ?? process.env['REQUEST_TIMINGS_ENABLED'] !== 'false')) return
    const projectId = options.projectId ?? process.env['GCLOUD_PROJECT']
    const requests = new WeakMap<FastifyRequest, RequestTimings>()

    function finish(request: FastifyRequest, outcome: string, statusCode?: number) {
        const timings = requests.get(request)
        if (!timings) return
        requests.delete(request)
        const traceparent = request.headers['traceparent']
        const cloudTrace = request.headers['x-cloud-trace-context']
        const traceId =
            (typeof traceparent === 'string' &&
                traceparent.match(/^[\da-f]{2}-([\da-f]{32})-[\da-f]{16}-[\da-f]{2}$/i)?.[1]) ||
            (typeof cloudTrace === 'string' && cloudTrace.match(/^([\da-f]{32})(?:\/|;|$)/i)?.[1])
        request.log.info(
            {
                severity: 'INFO',
                event: 'request_timing',
                method: request.method,
                route: request.routeOptions.url,
                outcome,
                statusCode,
                ...(projectId && traceId && !/^0+$/.test(traceId)
                    ? {
                          'logging.googleapis.com/trace': `projects/${projectId}/traces/${traceId.toLowerCase()}`
                      }
                    : {}),
                ...timings.finish()
            },
            'Request timing'
        )
    }

    fastify.addHook('onRequest', (request, _reply, done) => {
        if (!request.routeOptions.config.requestTiming) return done()
        const timings = new RequestTimings()
        requests.set(request, timings)
        timings.run(done)
    })
    fastify.addHook('onResponse', async (request, reply) =>
        finish(request, 'response', reply.statusCode)
    )
    fastify.addHook('onRequestAbort', async (request) => finish(request, 'aborted'))
    fastify.addHook('onTimeout', async (request) => finish(request, 'timeout'))
})
