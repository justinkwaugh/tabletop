import type { FastifyInstance } from 'fastify'
import { TournamentStallTask } from '@tabletop/backend-services'

export default async function (fastify: FastifyInstance) {
    fastify.post<{ Body: TournamentStallTask }>(
        '/stall',
        { schema: { body: TournamentStallTask } },
        async (request) => {
            await fastify.tournamentStallAlerts.check(request.body)
            return { status: 'ok' }
        }
    )
}
