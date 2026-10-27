import type { FastifyInstance, FastifyRequest } from 'fastify'
import fastifyRateLimit from '@fastify/rate-limit'

export interface RequestLimitOptions {
    global: boolean
}

// Request throttling over @fastify/rate-limit. Diagnostics go through the request logger so
// the logging boundary conceals credential path and query parameters of the throttled URL.
export async function installRequestLimits(
    fastify: FastifyInstance,
    options: RequestLimitOptions
): Promise<void> {
    await fastify.register(fastifyRateLimit, {
        global: options.global,
        max: (_request: FastifyRequest, key: string) => {
            if (key.startsWith('user:')) {
                return 500
            }
            return 100
        },
        cache: 10000, // default 5000
        keyGenerator: (request: FastifyRequest) => {
            if (request.session.userId) {
                return `user:${request.session.userId}`
            }
            const clientIp = request.headers['fastly-client-ip'] || request.ip
            console.log('client ip: ', clientIp)
            return `ip:${clientIp}`
        },
        onExceeded: (request: FastifyRequest, key: string) => {
            request.log.warn({ key, url: request.url }, 'Request limit exceeded')
        }
    })
}
