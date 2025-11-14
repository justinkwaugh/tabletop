import { FastifyInstance } from 'fastify'
import { Type, type Static } from 'typebox'

type DeclineGameRequest = Static<typeof DeclineGameRequest>
const DeclineGameRequest = Type.Object(
    {
        gameId: Type.String()
    },
    { additionalProperties: false }
)

export default async function (fastify: FastifyInstance) {
    fastify.post<{ Body: DeclineGameRequest }>(
        '/decline',
        {
            schema: { body: DeclineGameRequest },
            onRequest: fastify.auth([fastify.verifyActiveUser, fastify.verifyRoleUser], {
                relation: 'and'
            })
        },
        async function (request, _reply) {
            if (!request.user) {
                throw Error('No user found for create request')
            }

            const { gameId } = request.body

            const updatedGame = await fastify.gameService.declineGame({
                user: request.user,
                gameId
            })
            return { status: 'ok', payload: { game: updatedGame } }
        }
    )
}
