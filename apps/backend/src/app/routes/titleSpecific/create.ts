import { FastifyInstance } from 'fastify'
import { Type, type Static } from 'typebox'
import { Game, GameDefinition } from '@tabletop/common'

export default async function (definition: GameDefinition, fastify: FastifyInstance) {
    type CreateGameRequest = Static<typeof CreateGameRequest>
    const CreateGameRequest = Type.Object(
        {
            game: Type.Evaluate(
                Type.Intersect([
                    Type.Pick(Game, ['id', 'name', 'players', 'isPublic']),
                    Type.Object({
                        config: Type.Optional(definition.configSchema ?? Type.Object({}))
                    })
                ])
            )
        },
        { additionalProperties: false }
    )

    fastify.post<{ Body: CreateGameRequest }>(
        `/create`,
        {
            config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
            schema: { body: CreateGameRequest },
            onRequest: fastify.auth([fastify.verifyActiveUser, fastify.verifyRoleUser], {
                relation: 'and'
            })
        },
        async function (request, _reply) {
            if (!request.user) {
                throw Error('No user found for create request')
            }

            const game = request.body.game as Partial<Game>
            game.typeId = definition.id

            const newGame = await fastify.gameService.createGame({
                definition,
                game,
                owner: request.user
            })
            return { status: 'ok', payload: { game: newGame } }
        }
    )
}
