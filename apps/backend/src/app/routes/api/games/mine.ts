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

            const [active, completed] = await Promise.all([
                fastify.gameService.getActiveGamesForUser(request.user),
                request.query.scope === 'current'
                    ? []
                    : fastify.gameService.getCompletedGamesForUser(request.user)
            ])
            const timeOffsets = await fastify.timeDifferences.offsetsFor(active)
            return { status: 'ok', payload: { games: active.concat(completed), timeOffsets } }
        }
    )
}
