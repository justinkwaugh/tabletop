import { FastifyInstance } from 'fastify'
import { Type, type Static } from 'typebox'
import { GameDefinition } from '@tabletop/common'

type UndoRequest = Static<typeof UndoRequest>
const UndoRequest = Type.Object({
    gameId: Type.String(),
    actionId: Type.String()
})

export default async function (definition: GameDefinition, fastify: FastifyInstance) {
    fastify.post<{ Body: UndoRequest }>(
        '/undo',
        {
            schema: { body: UndoRequest },
            onRequest: fastify.auth([fastify.verifyUser], { relation: 'and' })
        },
        async function (request, _reply) {
            if (!request.user) {
                throw Error('No user found for create request')
            }

            const { gameId, actionId } = request.body
            const { undoneActions, updatedGame, redoneActions, canonicalReplay, checksum } =
                await fastify.gameService.undoAction({
                    user: request.user,
                    definition,
                    gameId,
                    actionId
                })

            return {
                status: 'ok',
                payload: {
                    // Compatibility for clients deployed before canonical replay.
                    undoneActions,
                    game: updatedGame,
                    redoneActions,
                    canonicalReplay,
                    checksum
                }
            }
        }
    )
}
