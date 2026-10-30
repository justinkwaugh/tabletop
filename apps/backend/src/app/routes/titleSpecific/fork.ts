import type { TitleResolver } from '../../lib/titleDefinition.js'
import { FastifyInstance } from 'fastify'
import { Type, type Static } from 'typebox'

type GameForkRequest = Static<typeof GameForkRequest>
const GameForkRequest = Type.Object({
    gameId: Type.String(),
    actionIndex: Type.Integer({ minimum: -1 }),
    name: Type.Optional(Type.String())
})

export default async function (title: TitleResolver, fastify: FastifyInstance) {
    fastify.post<{ Body: GameForkRequest }>(
        '/fork',
        {
            schema: { body: GameForkRequest },
            onRequest: fastify.auth([fastify.verifyUser], { relation: 'and' })
        },
        async function (request, _reply) {
            const definition = title(request)
            if (!request.principal) {
                throw Error('No principal found for fork request')
            }

            const { gameId, actionIndex, name } = request.body

            const forkedGame = await fastify.gameService.forkGame({
                definition,
                gameId,
                actionIndex,
                name,
                owner: request.principal
            })

            console.log(`Forked this game ${JSON.stringify(forkedGame)}`)
            return { status: 'ok', payload: { game: forkedGame } }
        }
    )
}
