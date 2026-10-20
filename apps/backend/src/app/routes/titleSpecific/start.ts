import { resolveTitle, type TitleDefinition } from '../../lib/titleDefinition.js'
import { FastifyInstance } from 'fastify'
import { Type, type Static } from 'typebox'
import { omitGameState } from '@tabletop/common'

type StartGameRequest = Static<typeof StartGameRequest>
const StartGameRequest = Type.Object({
    gameId: Type.String()
})

export default async function (source: TitleDefinition, fastify: FastifyInstance) {
    fastify.post<{ Body: StartGameRequest }>(
        `/start`,
        {
            schema: { body: StartGameRequest },
            onRequest: fastify.auth([fastify.verifyActiveUser, fastify.verifyRoleUser], {
                relation: 'and'
            })
        },
        async function (request, _reply) {
            const definition = resolveTitle(source, request)
            if (!request.user) {
                throw Error('No user found for create request')
            }

            const { gameId } = request.body
            const startedGame = await fastify.gameService.startGame({
                definition,
                gameId,
                user: request.user
            })

            return { status: 'ok', payload: { game: omitGameState(startedGame) } }
        }
    )
}
