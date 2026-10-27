import { GLOBAL_TOPIC, RELAY_STATS_TOPIC, gameTopic, userTopic } from '@tabletop/backend-services'
import { FastifyInstance } from 'fastify'
import { Type, type Static } from 'typebox'

const Query = Type.Object({
    game: Type.Optional(Type.Array(Type.String({ minLength: 1 }), { maxItems: 4 })),
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
            const principal = request.principal
            if (!principal) {
                throw new Error('No principal found for token request')
            }

            const grantsRelayStats = request.query.relayStats === true && principal.adminMode
            const gameIds = [...new Set(request.query.game)]
            const topics = [
                userTopic(principal.user.id),
                GLOBAL_TOPIC,
                ...gameIds.map(gameTopic),
                ...(grantsRelayStats ? [RELAY_STATS_TOPIC] : [])
            ]

            reply.header('Cache-Control', 'no-store')
            return {
                status: 'ok',
                payload: { token: issuer.issue({ userId: principal.user.id, topics }) }
            }
        }
    )
}
