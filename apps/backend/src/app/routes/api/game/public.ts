import type { FastifyInstance } from 'fastify'
import { GameStatus, normalizeGameConfig, type PublicGamePreview } from '@tabletop/common'
import { Type, type Static } from 'typebox'

const Params = Type.Object({ gameId: Type.String({ minLength: 1 }) })

export default async function (fastify: FastifyInstance) {
    fastify.get<{ Params: Static<typeof Params> }>(
        '/public/:gameId',
        { schema: { params: Params } },
        async function (request, reply) {
            reply.header('Cache-Control', 'no-store')
            const game = await fastify.gameService.getGame({ gameId: request.params.gameId })
            if (
                !game?.isPublic ||
                game.deleted ||
                game.hotseat ||
                game.tournament ||
                game.parentId ||
                game.status === GameStatus.Deleted ||
                game.status === GameStatus.Archived
            ) {
                return reply.code(404).send()
            }

            const definition = fastify.gameService.getTitle(game.typeId)
            if (!definition) return reply.code(503).send()
            const { id, typeId, name, ownerId, status, players, config } = game
            const payload: PublicGamePreview = {
                id,
                typeId,
                name,
                ownerId,
                status,
                players,
                config: normalizeGameConfig(config, definition.info.configurator),
                titleName: definition.info.metadata.name,
                configOptions: definition.info.configurator?.options ?? []
            }
            return { status: 'ok', payload }
        }
    )
}
