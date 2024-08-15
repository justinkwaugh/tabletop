import { FastifyInstance } from 'fastify'
import { Type, type Static } from '@sinclair/typebox'
import { Game } from '@tabletop/common'

type GameUpdateRequest = Static<typeof GameUpdateRequest>
const GameUpdateRequest = Type.Object({
    game: Type.Composite([
        Type.Pick(Game, ['id']),
        Type.Partial(Type.Pick(Game, ['name', 'players', 'isPublic']), {
            additionalProperties: false
        })
    ])
})

export default async function (fastify: FastifyInstance) {
    fastify.post<{ Body: GameUpdateRequest }>(
        '/update',
        {
            schema: { body: GameUpdateRequest },
            onRequest: fastify.auth([fastify.verifyUser], { relation: 'and' })
        },
        async function (request, _reply) {
            if (!request.user) {
                throw Error('No user found for create request')
            }

            const {
                game: { id, name, isPublic, players }
            } = request.body
            const updates = {
                name,
                isPublic,
                players
            }

            const updatedGame = await fastify.gameService.updateGame({
                gameId: id,
                fields: updates,
                owner: request.user
            })

            console.log(`Updated game ${JSON.stringify(updatedGame)}`)
            return { status: 'ok', payload: { game: updatedGame } }
        }
    )
}
