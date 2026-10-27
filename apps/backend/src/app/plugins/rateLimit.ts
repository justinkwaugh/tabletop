import fp from 'fastify-plugin'
import fastifyRateLimit from '@fastify/rate-limit'
import { clientAddress } from '../../runtime/clientAddress.js'

export interface RateLimitPluginOptions {
    service: string
}

export default fp(async function (fastify, { service }: RateLimitPluginOptions) {
    await fastify.register(fastifyRateLimit, {
        global: service !== 'local',
        max: (_request, key) => (key.startsWith('user:') ? 500 : 100),
        cache: 10000,
        keyGenerator: (request) =>
            request.session.userId
                ? `user:${request.session.userId}`
                : `ip:${clientAddress(request)}`,
        onExceeded: (request, key) =>
            request.log.warn({ key, url: request.url }, 'Request limit exceeded')
    })
})
