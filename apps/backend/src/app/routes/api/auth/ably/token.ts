import { FastifyInstance } from 'fastify'
import { RealtimeGameTopicsQuery, realtimeTopicsFor } from '../../../../lib/realtimeTopics.js'

export default async function (fastify: FastifyInstance) {
    fastify.get<{ Querystring: RealtimeGameTopicsQuery }>(
        '/token',
        {
            schema: { querystring: RealtimeGameTopicsQuery },
            config: { rateLimit: { max: 1000, timeWindow: '1 minute' } },
            onRequest: fastify.auth([fastify.verifyActiveUser, fastify.verifyRoleUser], {
                relation: 'and'
            })
        },
        async function (request, reply) {
            if (!request.user) {
                throw Error('No user found for token request')
            }
            const token = await fastify.ablyService.createTokenRequest({
                userId: request.user.id,
                topics: realtimeTopicsFor({ user: request.user, gameIds: request.query.game })
            })
            reply.header('Cache-Control', 'no-store')
            return { status: 'ok', payload: { token } }
        }
    )
}
