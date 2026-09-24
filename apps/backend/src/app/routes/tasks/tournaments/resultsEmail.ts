import type { FastifyInstance } from 'fastify'
import { TournamentResultsEmailTask } from '@tabletop/backend-services'

const FRONTEND_HOST = process.env['FRONTEND_HOST'] || ''

export default async function (fastify: FastifyInstance) {
    fastify.post<{ Body: TournamentResultsEmailTask }>(
        '/resultsEmail',
        { schema: { body: TournamentResultsEmailTask } },
        async (request) => {
            const { tournamentId, userId, toEmail } = request.body
            const recipient = await fastify.userService.getUser(userId)
            if (!recipient) {
                fastify.log.error(`User ${userId} not found, cannot send tournament results`)
                return { status: 'skipped' }
            }
            const detail = await fastify.tournamentService.get(tournamentId, recipient)
            const definition = fastify.gameService.getTitle(detail.tournament.rules.titleId)
            if (!definition) {
                fastify.log.error(
                    `Title ${detail.tournament.rules.titleId} not supported, cannot send tournament results`
                )
                return { status: 'skipped' }
            }
            await fastify.emailService.sendTournamentResultsEmail({
                detail,
                definition,
                recipientId: userId,
                url: `${FRONTEND_HOST}/tournaments/${encodeURIComponent(tournamentId)}`,
                toEmail
            })
            return { status: 'ok' }
        }
    )
}
