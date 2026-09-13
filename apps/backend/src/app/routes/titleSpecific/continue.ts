import { FastifyInstance } from 'fastify'
import { Type, type Static } from 'typebox'
import { GameDefinition, omitGameState } from '@tabletop/common'

type ContinueGameRequest = Static<typeof ContinueGameRequest>
const ContinueGameRequest = Type.Object(
    {
        gameId: Type.String()
    },
    { additionalProperties: false }
)

export default async function (definition: GameDefinition, fastify: FastifyInstance) {
    fastify.post<{ Body: ContinueGameRequest }>(
        `/continue`,
        {
            schema: { body: ContinueGameRequest },
            config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
            onRequest: fastify.auth([fastify.verifyActiveUser, fastify.verifyRoleUser], {
                relation: 'and'
            })
        },
        async function (request, _reply) {
            if (!request.user) {
                throw Error('No user found for create request')
            }

            const { gameId } = request.body
            const continuedGame = await fastify.gameService.continueGame({
                definition,
                gameId,
                user: request.user
            })

            return { status: 'ok', payload: { game: omitGameState(continuedGame) } }
        }
    )
}
