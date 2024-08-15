import { FastifyInstance } from 'fastify'
import { Type, type Static } from '@sinclair/typebox'

type ParamsType = Static<typeof ParamsType>
const ParamsType = Type.Object({
    gameId: Type.String()
})

type QueryType = Static<typeof QueryType>
const QueryType = Type.Object({
    since: Type.Optional(Type.Number())
})

export default async function (fastify: FastifyInstance) {
    fastify.get<{ Params: ParamsType; Querystring: QueryType }>(
        '/actions/:gameId',
        {
            onRequest: fastify.auth([fastify.verifyActiveUser, fastify.verifyRoleUser], {
                relation: 'and'
            })
        },
        async function (request, _reply) {
            if (!request.user) {
                throw Error('No user found for token request')
            }

            const { gameId } = request.params
            const { since } = request.query

            const sinceNum = since ? Number(since) : undefined
            const actions = await fastify.gameService.getActionsForGame(gameId, sinceNum)

            return { status: 'ok', payload: { actions } }
        }
    )
}
