import type { FastifyInstance } from 'fastify'
import { GameAutoStartTask } from '@tabletop/backend-services'

export default async function (fastify: FastifyInstance) {
    fastify.post<{ Body: GameAutoStartTask }>(
        '/autoStart',
        { schema: { body: GameAutoStartTask } },
        async (request) => {
            await fastify.gameService.autoStartGame(request.body)
            return { status: 'ok' }
        }
    )
}
