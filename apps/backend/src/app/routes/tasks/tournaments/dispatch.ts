import type { FastifyInstance } from 'fastify'
import { TournamentTask } from '@tabletop/backend-services'

export default async function (fastify: FastifyInstance) {
    fastify.post<{ Body: TournamentTask }>(
        '/dispatch',
        { schema: { body: TournamentTask } },
        async (request) => {
            await fastify.tournamentService.runTask(request.body)
            return { status: 'ok' }
        }
    )
}
