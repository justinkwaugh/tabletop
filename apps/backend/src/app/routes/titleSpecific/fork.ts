import { FastifyInstance } from 'fastify'
import { Type, type Static } from '@sinclair/typebox'
import { GameDefinition } from '@tabletop/common'

type GameForkRequest = Static<typeof GameForkRequest>
const GameForkRequest = Type.Object({
    gameId: Type.String(),
    actionIndex: Type.Number({ minimum: -1 })
})

export default async function (definition: GameDefinition, fastify: FastifyInstance) {
    fastify.post<{ Body: GameForkRequest }>(
        '/fork',
        {
            schema: { body: GameForkRequest },
            onRequest: fastify.auth([fastify.verifyUser], { relation: 'and' })
        },
        async function (request, _reply) {
            if (!request.user) {
                throw Error('No user found for create request')
            }

            const { gameId, actionIndex } = request.body

            const forkedGame = await fastify.gameService.forkGame({
                definition,
                gameId,
                actionIndex,
                owner: request.user
            })

            console.log(`Forked this game ${JSON.stringify(forkedGame)}`)
            return { status: 'ok', payload: { game: forkedGame } }
        }
    )
}
