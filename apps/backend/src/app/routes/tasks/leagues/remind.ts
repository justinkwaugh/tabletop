import type { FastifyInstance } from 'fastify'
import { LeagueReminderTask } from '@tabletop/backend-services'

export default async function (fastify: FastifyInstance) {
    fastify.post<{ Body: LeagueReminderTask }>(
        '/remind',
        { schema: { body: LeagueReminderTask } },
        async (request) => {
            await fastify.leagueService.runReminder(request.body)
            return { status: 'ok' }
        }
    )
}
