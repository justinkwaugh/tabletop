import { resolveTitle, type TitleDefinition } from '../../lib/titleDefinition.js'
import { FastifyInstance } from 'fastify'
import { Type, type Static } from 'typebox'

type UndoRequest = Static<typeof UndoRequest>
const UndoRequest = Type.Object({
    gameId: Type.String(),
    actionId: Type.String()
})

export default async function (source: TitleDefinition, fastify: FastifyInstance) {
    fastify.post<{ Body: UndoRequest }>(
        '/undo',
        {
            config: { requestTiming: true },
            schema: { body: UndoRequest },
            onRequest: fastify.auth([fastify.verifyUser], { relation: 'and' })
        },
        async function (request, _reply) {
            const definition = resolveTitle(source, request)
            if (!request.user) {
                throw Error('No user found for create request')
            }

            const { gameId, actionId } = request.body
            const representation = await fastify.gameService.undoAction({
                user: request.user,
                definition,
                gameId,
                actionId
            })

            return {
                status: 'ok',
                payload: representation
            }
        }
    )
}
