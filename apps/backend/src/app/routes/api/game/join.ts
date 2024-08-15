import { FastifyInstance } from 'fastify'
import { Type, type Static } from '@sinclair/typebox'

type JoinGameRequest = Static<typeof JoinGameRequest>
const JoinGameRequest = Type.Object(
    {
        gameId: Type.String()
    },
    { additionalProperties: false }
)

export default async function (fastify: FastifyInstance) {
    fastify.post<{ Body: JoinGameRequest }>(
        '/join',
        {
            schema: { body: JoinGameRequest },
            onRequest: fastify.auth([fastify.verifyActiveUser, fastify.verifyRoleUser], {
                relation: 'and'
            })
        },
        async function (request, _reply) {
            if (!request.user) {
                throw Error('No user found for create request')
            }

            const { gameId } = request.body

            const updatedGame = await fastify.gameService.joinGame({ user: request.user, gameId })
            return { status: 'ok', payload: { game: updatedGame } }
        }
    )
}
