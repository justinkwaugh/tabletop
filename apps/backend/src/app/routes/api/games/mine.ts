import { FastifyInstance } from 'fastify'
import * as Type from 'typebox'

const Query = Type.Object(
    { scope: Type.Optional(Type.Literal('current')) },
    { additionalProperties: false }
)

export default async function (fastify: FastifyInstance) {
    fastify.get<{ Querystring: Type.Static<typeof Query> }>(
        `/mine`,
        {
            schema: { querystring: Query },
            onRequest: fastify.auth([fastify.verifyActiveUser, fastify.verifyRoleUser], {
                relation: 'and'
            })
        },
        async function (request) {
            if (!request.user) {
                throw Error('No user found for create request')
            }

            if (request.query.scope === 'current') {
                return {
                    status: 'ok',
                    payload: {
                        games: await fastify.gameService.getActiveGamesForUser(request.user)
                    }
                }
            }

            const results = await Promise.all([
                fastify.gameService.getActiveGamesForUser(request.user),
                fastify.gameService.getCompletedGamesForUser(request.user)
            ])
            const games = results[0].concat(results[1])

            return { status: 'ok', payload: { games } }
        }
    )
}
