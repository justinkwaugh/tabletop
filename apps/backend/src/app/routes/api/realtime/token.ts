import { GLOBAL_TOPIC, gameTopic, userTopic } from '@tabletop/backend-services'
import { FastifyInstance } from 'fastify'
import { Type, type Static } from 'typebox'

const Query = Type.Object({
    game: Type.Optional(Type.Array(Type.String({ minLength: 1 }), { maxItems: 4 }))
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

            const gameIds = [...new Set(request.query.game)]
            const topics = [userTopic(request.user.id), GLOBAL_TOPIC, ...gameIds.map(gameTopic)]

            reply.header('Cache-Control', 'no-store')
            return {
                status: 'ok',
                payload: { token: issuer.issue({ userId: request.user.id, topics }) }
            }
        }
    )
}
