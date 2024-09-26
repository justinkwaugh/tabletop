import { FastifyInstance } from 'fastify'
import { Type, type Static } from '@sinclair/typebox'

type DeleteGameRequest = Static<typeof DeleteGameRequest>
const DeleteGameRequest = Type.Object(
    {
        gameId: Type.String()
    },
    { additionalProperties: false }
)

export default async function (fastify: FastifyInstance) {
    fastify.post<{ Body: DeleteGameRequest }>(
        '/delete',
        {
            schema: { body: DeleteGameRequest },
            onRequest: fastify.auth([fastify.verifyUser], { relation: 'and' })
        },
        async function (request, _reply) {
            if (!request.user) {
                throw Error('No user found for create request')
            }

            await fastify.gameService.deleteGame(request.user, request.body.gameId)
            return { status: 'ok', payload: {} }
        }
    )
}
