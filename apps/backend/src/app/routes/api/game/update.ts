import { FastifyInstance } from 'fastify'
import { Type, type Static } from 'typebox'
import { Game } from '@tabletop/common'

type GameUpdateRequest = Static<typeof GameUpdateRequest>
const GameUpdateRequest = Type.Object({
    game: Type.Evaluate(
        Type.Intersect([
            Type.Pick(Game, ['id']),
            Type.Partial(
                Type.Pick(Game, ['name', 'players', 'isPublic', 'paceMinutes', 'config']),
                {
                    additionalProperties: false
                }
            )
        ])
    )
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
                game: { id, name, isPublic, paceMinutes, players, config }
            } = request.body
            const updates: Partial<Game> = {
                ...(name === undefined ? {} : { name }),
                ...(isPublic === undefined ? {} : { isPublic }),
                ...(paceMinutes === undefined ? {} : { paceMinutes }),
                ...(players === undefined ? {} : { players }),
                ...(config === undefined ? {} : { config })
            }

            const updatedGame = await fastify.gameService.updateGame({
                gameId: id,
                fields: updates,
                user: request.user
            })

            console.log(`Updated this game ${JSON.stringify(updatedGame)}`)
            return { status: 'ok', payload: { game: updatedGame } }
        }
    )
}
