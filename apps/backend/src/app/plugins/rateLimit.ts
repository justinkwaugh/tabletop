import fp from 'fastify-plugin'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import fastifyRateLimit, { normalizeIP, type RateLimitOptions } from '@fastify/rate-limit'
import {
    LocalRateLimitCounter,
    type RateLimitCounter
} from '@tabletop/backend-services/rate-limit-counter'
import { clientIdentity } from '../../runtime/clientAddress.js'
import { rejectWhenExceeded } from '../lib/budgetExceeded.js'
import { rateLimitCounterStore } from './rateLimitStore.js'

export interface RateLimitPluginOptions {
    service: string
    counter?: RateLimitCounter
    keyScope?: string
}

export const anonymousRequestsPerMinute = 100
export const sessionRequestsPerMinute = 500
// Browsers behind one Firebase Hosting address that may each spend a full client budget at once.
export const browsersPerHostingPeer = 3

type RouteBudget = RateLimitOptions | false | undefined
type ConsumeBudget = ReturnType<FastifyInstance['createRateLimit']>

function hostingPeerMax(max: RateLimitOptions['max']): RateLimitOptions['max'] {
    if (max === undefined) return anonymousRequestsPerMinute * browsersPerHostingPeer
    if (typeof max === 'number') return max * browsersPerHostingPeer
    return async (request, key) => browsersPerHostingPeer * (await max(request, key))
}

function routeKey(request: FastifyRequest): string {
    return `${request.routeOptions.method}:${request.routeOptions.url ?? ''}`
}

export default fp(
    async function (
        fastify,
        {
            service,
            counter = new LocalRateLimitCounter(),
            keyScope = 'rate-limit:'
        }: RateLimitPluginOptions
    ) {
        if (service === 'tasks') return

        const limitsEveryRoute = service !== 'local'
        await fastify.register(fastifyRateLimit, {
            global: limitsEveryRoute,
            store: rateLimitCounterStore(counter, keyScope),
            max: (_request, key) =>
                key.startsWith('user:') ? sessionRequestsPerMinute : anonymousRequestsPerMinute,
            keyGenerator: (request) =>
                request.session.userId
                    ? `user:${request.session.userId}`
                    : `client:${normalizeIP(clientIdentity(request).client, 64)}`,
            onExceeded: (request, key) =>
                request.log.warn({ key, url: request.url }, 'Request limit exceeded')
        })

        const hostingPeerBudgets = new Map<string, ConsumeBudget>()
        const hostingPeerBudget = (
            request: FastifyRequest,
            budget: RateLimitOptions | undefined
        ) => {
            const route = routeKey(request)
            let consume = hostingPeerBudgets.get(route)
            if (!consume) {
                consume = fastify.createRateLimit({
                    max: hostingPeerMax(budget?.max),
                    timeWindow: budget?.timeWindow ?? '1 minute',
                    keyGenerator: (limited) => `peer:${route}:${normalizeIP(limited.ip, 128)}`
                })
                hostingPeerBudgets.set(route, consume)
            }
            return consume
        }

        // The forwarded client address can be chosen by any Google-hosted caller, so every budget
        // keyed by it is also bounded per ingress peer, which only the connection can set.
        fastify.addHook('onRequest', async (request, reply) => {
            const budget: RouteBudget = request.routeOptions.config.rateLimit
            if (budget === false || (budget === undefined && !limitsEveryRoute)) return
            if (request.session.userId) return
            const identity = clientIdentity(request)
            if (identity.attribution !== 'hosting-hint') return
            const outcome = await hostingPeerBudget(request, budget)(request)
            if (!outcome.isAllowed && outcome.isExceeded) {
                request.log.warn(
                    { ingressPeer: identity.ingressPeer, url: request.url },
                    'Hosting peer request limit exceeded'
                )
            }
            rejectWhenExceeded(reply, outcome, 'requests through this Hosting address')
        })
    },
    { name: 'rate-limit', dependencies: ['@fastify/secure-session'] }
)
