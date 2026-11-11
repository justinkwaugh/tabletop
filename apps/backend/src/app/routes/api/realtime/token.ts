import { FastifyInstance } from 'fastify'
import { Type, type Static } from 'typebox'
import { RealtimeGameTopicsQuery, realtimeTopicsFor } from '../../../lib/realtimeTopics.js'

const Query = Type.Object({
    ...RealtimeGameTopicsQuery.properties,
    relayStats: Type.Optional(Type.Boolean())
})

export default async function (fastify: FastifyInstance) {
    fastify.get<{ Querystring: Static<typeof Query> }>(
        '/token',
        {
            schema: { querystring: Query },
            onRequest: fastify.auth([fastify.verifyActiveUser, fastify.verifyRoleUser], {
                relation: 'and'
            })
        },
        async function (request, reply) {
            const issuer = fastify.realtimeTokenIssuer
            if (!issuer) {
                return reply.code(404).send()
            }
            if (!request.user) {
                throw new Error('No user found for token request')
            }

            const topics = realtimeTopicsFor({
                user: request.user,
                gameIds: request.query.game,
                relayStats: request.query.relayStats
            })

            reply.header('Cache-Control', 'no-store')
            return {
                status: 'ok',
                payload: { token: issuer.issue({ userId: request.user.id, topics }) }
            }
        }
    )
}
