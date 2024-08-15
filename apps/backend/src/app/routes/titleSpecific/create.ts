import { FastifyInstance } from 'fastify'
import { Type, type Static } from '@sinclair/typebox'
import { Game, GameDefinition } from '@tabletop/common'

type CreateGameRequest = Static<typeof CreateGameRequest>
const CreateGameRequest = Type.Object(
    {
        game: Type.Composite([
            Type.Pick(Game, ['id', 'name', 'players', 'isPublic']),
            Type.Partial(Type.Pick(Game, ['config'], { additionalProperties: false }))
        ])
    },
    { additionalProperties: false }
)

export default async function (definition: GameDefinition, fastify: FastifyInstance) {
    fastify.post<{ Body: CreateGameRequest }>(
        `/create`,
        {
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
