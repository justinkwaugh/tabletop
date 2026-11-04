import type { FastifyInstance } from 'fastify'
import { AccountGamesTask } from '@tabletop/backend-services'

export default async function (fastify: FastifyInstance) {
    fastify.post<{ Body: AccountGamesTask }>(
        '/syncPlayerNames',
        { schema: { body: AccountGamesTask } },
        async (request) => {
            await fastify.accountModeration.syncPlayerNames(request.body)
            return { status: 'ok', payload: {} }
        }
    )

    fastify.post<{ Body: AccountGamesTask }>(
        '/releaseBannedPlayer',
        { schema: { body: AccountGamesTask } },
        async (request) => {
            await fastify.accountModeration.releaseBannedPlayer(request.body)
            return { status: 'ok', payload: {} }
        }
    )
}
