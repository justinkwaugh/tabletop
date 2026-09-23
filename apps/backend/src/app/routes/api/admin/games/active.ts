import { FastifyInstance } from 'fastify'
import { Type, type Static } from 'typebox'

type ActiveGamesQuery = Static<typeof ActiveGamesQuery>
const ActiveGamesQuery = Type.Object({ titleId: Type.String() }, { additionalProperties: false })

export default async function (fastify: FastifyInstance) {
    fastify.get<{ Querystring: ActiveGamesQuery }>(
        '/active',
        {
            schema: { querystring: ActiveGamesQuery },
            onRequest: fastify.auth([fastify.verifyActiveUser, fastify.verifyRoleAdmin], {
                relation: 'and'
            })
        },
        async function (request) {
            const games = await fastify.gameService.getActiveGamesForTitle(request.query.titleId)
            return { status: 'ok', payload: { games } }
        }
    )
}
