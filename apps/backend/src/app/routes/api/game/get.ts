import { FastifyInstance } from 'fastify'
import { Type, type Static } from 'typebox'

type ParamsType = Static<typeof ParamsType>
const ParamsType = Type.Object({
    gameId: Type.String()
})

type QueryType = Static<typeof QueryType>
const QueryType = Type.Object({
    view: Type.Optional(Type.Literal('host'))
})

export default async function (fastify: FastifyInstance) {
    fastify.get<{ Params: ParamsType; Querystring: QueryType }>(
        '/get/:gameId',
        {
            schema: { querystring: QueryType },
            onRequest: fastify.auth([fastify.verifyActiveUser, fastify.verifyRoleUser], {
                relation: 'and'
            })
        },
        async function (request, reply) {
            if (!request.user) {
                throw Error('No user found for token request')
            }

            const { gameId } = request.params
            const hostView = request.query.view === 'host'
            if (hostView && !fastify.gameService.canAccessHostView(request.user)) {
                await reply.code(403).send()
                return
            }

            const gameEtag = await fastify.gameService.getGameEtagForUser({
                gameId,
                hostView,
                user: request.user
            })

            if (gameEtag === undefined) {
                await reply.code(404).send()
                return
            }

            const responseEtag = `W/"${gameEtag}"`
            void reply.header('ETag', responseEtag)
            void reply.header('Cache-Control', 'private, no-cache')
            if (request.headers['if-none-match'] === responseEtag) {
                await reply.code(304).send()
                return
            }

            const representation = await fastify.gameService.getGameForUser({
                gameId,
                hostView,
                user: request.user
            })

            if (representation === undefined) {
                await reply.code(404).send()
                return
            }

            return {
                status: 'ok',
                payload: { game: representation.game, actions: representation.actions }
            }
        }
    )
}
