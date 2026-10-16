import type { FastifyInstance } from 'fastify'
import { LeagueTask } from '@tabletop/backend-services'

export default async function (fastify: FastifyInstance) {
    fastify.post<{ Body: LeagueTask }>(
        '/advance',
        { schema: { body: LeagueTask } },
        async (request) => {
            await fastify.leagueService.runTask(request.body)
            return { status: 'ok' }
        }
    )
}
