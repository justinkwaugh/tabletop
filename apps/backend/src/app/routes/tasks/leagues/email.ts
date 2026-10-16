import type { FastifyInstance } from 'fastify'
import { UserStatus } from '@tabletop/common'
import { LeagueEmailTask } from '@tabletop/backend-services'

const FRONTEND_HOST = process.env['FRONTEND_HOST'] || ''
const EMAIL_CLAIM_SECONDS = 60 * 86_400

export default async function (fastify: FastifyInstance) {
    fastify.post<{ Body: LeagueEmailTask }>(
        '/email',
        { schema: { body: LeagueEmailTask } },
        async (request) => {
            const recipient = await fastify.userService.getUser(request.body.userId)
            if (recipient?.status !== UserStatus.Active || !recipient.email)
                return { status: 'skipped' }
            const content = await fastify.leagueService.emailContent(request.body)
            if (!content) return { status: 'skipped' }
            const definition = fastify.gameService.getTitle(content.titleId)
            if (!definition) {
                fastify.log.error(
                    `Title ${content.titleId} not supported, cannot send league email`
                )
                return { status: 'skipped' }
            }
            const claim = `leagues:v1:email:${JSON.stringify([
                content.leagueId,
                content.seasonNumber,
                content.kind,
                request.body.closesAt ?? null,
                recipient.id
            ])}`
            if (!(await fastify.cacheService.claimOnce(claim, EMAIL_CLAIM_SECONDS)))
                return { status: 'duplicate' }
            const email = {
                leagueName: content.leagueName,
                title: definition.info.metadata.name,
                seasonNumber: content.seasonNumber,
                toEmail: recipient.email
            }
            const leagueUrl = `${FRONTEND_HOST}/leagues/${encodeURIComponent(content.leagueId)}`
            try {
                if (content.kind === 'seasonResults')
                    await fastify.emailService.sendLeagueSeasonResultsEmail({
                        ...email,
                        groupName: content.groupName,
                        place: content.place,
                        movement: content.movement,
                        nextLevel: content.nextLevel,
                        ...(content.champion ? { champion: content.champion } : {}),
                        standings: content.standings,
                        url: `${leagueUrl}?season=${content.seasonNumber}`
                    })
                else if (content.kind === 'seasonStart')
                    await fastify.emailService.sendLeagueSeasonStartEmail({
                        ...email,
                        groupName: content.groupName,
                        ...(content.level ? { level: content.level } : {}),
                        opponents: content.opponents,
                        gamesEach: content.gamesEach,
                        url: `${FRONTEND_HOST}/tournaments/${encodeURIComponent(content.tournamentId)}`
                    })
                else
                    await fastify.emailService.sendLeagueSignUpEmail({
                        ...email,
                        reminder: content.kind === 'signUpReminder',
                        level: content.level,
                        closesAt: content.closesAt,
                        url: leagueUrl
                    })
            } catch (error) {
                await fastify.cacheService.delete(claim)
                throw error
            }
            return { status: 'ok' }
        }
    )
}
