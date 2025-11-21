import { FastifyInstance } from 'fastify'
import { Type, type Static } from 'typebox'
import { GameDefinition } from '@tabletop/common'

type StartGameRequest = Static<typeof StartGameRequest>
const StartGameRequest = Type.Object({
    gameId: Type.String()
})

export default async function (definition: GameDefinition, fastify: FastifyInstance) {
    fastify.post<{ Body: StartGameRequest }>(
        `/start`,
        {
            schema: { body: StartGameRequest },
            onRequest: fastify.auth([fastify.verifyActiveUser, fastify.verifyRoleUser], {
                relation: 'and'
            })
        },
        async function (request, _reply) {
            if (!request.user) {
                throw Error('No user found for create request')
            }

            const { gameId } = request.body
            const startedGame = await fastify.gameService.startGame({
                definition,
                gameId,
                user: request.user
            })

            return { status: 'ok', payload: { game: startedGame } }
        }
    )
}
