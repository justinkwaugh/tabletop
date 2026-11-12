import { nanoid } from 'nanoid'

import { Resend } from 'resend'
import { SecretsService } from '../secrets/secretsService'
import {
    AUTHENTICATION_CHALLENGE_LIFETIME_SECONDS,
    CONTENT_REPORT_REASON_LABELS,
    CONTENT_REPORT_TARGET_LABELS,
    Game,
    GameDefinition,
    TournamentDetail,
    formatTournamentTiebreaks,
    ranksByAveragePlace,
    formatTournamentAveragePlace,
    tournamentTiebreakDescription,
    User
} from '@tabletop/common'
import {
    AccountChangeType,
    EmailService,
    type LeagueSeasonResultsEmail,
    type LeagueSeasonStartEmail,
    type LeagueSignUpEmail
} from './emailService.js'
import { NullEmailService } from './nullEmailService.js'
import type { ContentReportEmail } from '../moderation/contentReports.js'

function formatReportTime(time: Date): string {
    return `${time.toISOString().slice(0, 16).replace('T', ' ')} UTC`
}

const CHALLENGE_LIFETIME_MINUTES = AUTHENTICATION_CHALLENGE_LIFETIME_SECONDS / 60

type EmailRendering = {
    render: (typeof import('@react-email/components'))['render']
    templates: typeof import('@tabletop/email')
}

export class ResendEmailService implements EmailService {
    private resend!: Resend
    private rendering?: Promise<EmailRendering>
    private constructor() {}

    // The templates pull in the whole react-email component set, which is too costly to
    // import while the backend starts; load it with the first email instead.
    private loadRendering(): Promise<EmailRendering> {
        this.rendering ??= Promise.all([
            import('@react-email/components'),
            import('@tabletop/email')
        ]).then(([{ render }, templates]) => ({ render, templates }))
        return this.rendering
    }

    private async send(to: string, subject: string, html: string): Promise<void> {
        const { templates } = await this.loadRendering()
        await this.resend.emails.send({
            from: 'noreply@boardtogether.games',
            to,
            subject,
            html,
            // Sent rather than left for Resend to derive from the HTML, for clients that cannot
            // show the HTML, such as old Eudora.
            text: templates.emailPlainText(html),
            headers: {
                'X-Entity-Ref-ID': nanoid()
            }
        })
    }

    static async createEmailService(secretsService: SecretsService): Promise<EmailService> {
        const emailService = new ResendEmailService()
        const resendKey = await secretsService.getSecret('RESEND_API_KEY')
        if (!resendKey) {
            return new NullEmailService()
        }
        emailService.resend = new Resend(resendKey)
        return emailService
    }

    async sendVerificationEmail(token: string, toEmail: string): Promise<void> {
        const { render, templates } = await this.loadRendering()
        const emailHTML = await render(
            templates.EmailVerification({ token, expiresInMinutes: CHALLENGE_LIFETIME_MINUTES })
        )
        await this.send(toEmail, 'Verify your email address', emailHTML)
    }

    async sendPasswordResetEmail(token: string, url: string, toEmail: string): Promise<void> {
        const { render, templates } = await this.loadRendering()
        const emailHTML = await render(
            templates.PasswordReset({ url, expiresInMinutes: CHALLENGE_LIFETIME_MINUTES })
        )
        await this.send(toEmail, 'Reset your password', emailHTML)
    }

    async sendAccountChangedNotificationEmail(
        changeType: AccountChangeType,
        timestamp: Date,
        toEmail: string,
        username?: string
    ): Promise<void> {
        const { render, templates } = await this.loadRendering()
        const emailHTML = await render(
            templates.AccountChangeNotification({ changeType, timestamp, username })
        )
        await this.send(toEmail, 'Account change notification', emailHTML)
    }

    async sendGameInvitationEmail({
        owner,
        game,
        definition,
        url,
        toEmail
    }: {
        owner: User
        game: Game
        definition: GameDefinition
        url: string
        toEmail: string
    }): Promise<void> {
        const { render, templates } = await this.loadRendering()
        const emailHTML = await render(
            templates.GameInvitation({
                ownerName: owner.username ?? 'someone',
                gameName: game.name,
                title: definition.info.metadata.name,
                url
            })
        )
        await this.send(
            toEmail,
            `Join ${owner.username}'s game of ${definition.info.metadata.name}`,
            emailHTML
        )
    }

    async sendContentReportEmail(report: ContentReportEmail): Promise<void> {
        const { render, templates } = await this.loadRendering()
        const targetLabel = CONTENT_REPORT_TARGET_LABELS[report.targetKind]
        const reasonLabel = CONTENT_REPORT_REASON_LABELS[report.reason]
        const emailHTML = await render(
            templates.ContentReport({
                ...report,
                targetLabel,
                reasonLabel,
                reportedAt: formatReportTime(new Date(report.reportedAt))
            })
        )
        await this.send(report.toEmail, `Report: ${targetLabel}, ${reasonLabel}`, emailHTML)
    }

    async sendPlayerRemovedEmail({
        playerName,
        game,
        definition,
        url,
        toEmail,
        deletedAccount
    }: {
        playerName: string
        game: Game
        definition: GameDefinition
        url: string
        toEmail: string
        deletedAccount: boolean
    }): Promise<void> {
        const { render, templates } = await this.loadRendering()
        const emailHTML = await render(
            templates.PlayerRemoved({
                playerName,
                title: definition.info.metadata.name,
                gameName: game.name,
                url,
                deletedAccount
            })
        )
        const subject = deletedAccount
            ? `A player left ${game.name}`
            : `A player was removed from ${game.name}`
        await this.send(toEmail, subject, emailHTML)
    }

    async sendGameEndEmail({
        winners,
        game,
        definition,
        url,
        toEmail
    }: {
        winners: User[]
        game: Game
        definition: GameDefinition
        url: string
        toEmail: string
    }): Promise<void> {
        if (!game.result) {
            console.log('Game result is missing for game end email')
            return
        }

        const { render, templates } = await this.loadRendering()
        const emailHTML = await render(
            templates.GameEnd({
                result: game.result,
                winners: winners.map((w) => w.username || 'A Player'),
                callKind: game.call?.kind,
                gameName: game.name,
                title: definition.info.metadata.name,
                url
            })
        )
        await this.send(
            toEmail,
            `Your game of ${definition.info.metadata.name} ${game.name} has ended`,
            emailHTML
        )
    }

    async sendTournamentResultsEmail({
        detail,
        definition,
        recipientId,
        url,
        toEmail
    }: {
        detail: TournamentDetail
        definition: GameDefinition
        recipientId: string
        url: string
        toEmail: string
    }): Promise<void> {
        const standings = detail.standings ?? []
        if (detail.tournament.status !== 'finished' || !standings.length) {
            console.log('Tournament results are unavailable for results email')
            return
        }
        const name = (userId: string) => detail.usernames[userId] ?? 'A Player'
        const ranked = standings.filter((row) => !row.withdrawn)
        const tiebreaks = formatTournamentTiebreaks(ranked, 'en-US')
        const { render, templates } = await this.loadRendering()
        const emailHTML = await render(
            templates.TournamentResults({
                tournamentName: detail.tournament.name,
                title: definition.info.metadata.name,
                winners: standings.filter((row) => row.champion).map((row) => name(row.userId)),
                tiebreakDescription: tournamentTiebreakDescription(standings),
                ranksByAveragePlace: ranksByAveragePlace(detail.tournament.rules),
                standings: ranked.map((row, index) => ({
                    rank: row.rank,
                    name: name(row.playedBy ?? row.userId),
                    wins: row.wins,
                    score: row.score,
                    averagePlace: formatTournamentAveragePlace(row),
                    tiebreak: tiebreaks[index],
                    recipient: (row.playedBy ?? row.userId) === recipientId,
                    champion: row.champion === true
                })),
                url
            })
        )
        await this.send(toEmail, `Final results for ${detail.tournament.name}`, emailHTML)
    }

    async sendLeagueSignUpEmail({ toEmail, ...props }: LeagueSignUpEmail): Promise<void> {
        const { render, templates } = await this.loadRendering()
        const emailHTML = await render(templates.LeagueSignUp(props))
        await this.send(
            toEmail,
            props.reminder
                ? `Sign-up for ${props.leagueName} closes soon`
                : `Sign-up for ${props.leagueName} Season ${props.seasonNumber} is open`,
            emailHTML
        )
    }

    async sendLeagueSeasonStartEmail({ toEmail, ...props }: LeagueSeasonStartEmail): Promise<void> {
        const { render, templates } = await this.loadRendering()
        const emailHTML = await render(templates.LeagueSeasonStart(props))
        await this.send(
            toEmail,
            `${props.leagueName} Season ${props.seasonNumber} has started`,
            emailHTML
        )
    }

    async sendLeagueSeasonResultsEmail({
        toEmail,
        ...props
    }: LeagueSeasonResultsEmail): Promise<void> {
        const { render, templates } = await this.loadRendering()
        const emailHTML = await render(templates.LeagueSeasonResults(props))
        await this.send(
            toEmail,
            `${props.leagueName} ${templates.leagueSeasonResultsName(props)} results`,
            emailHTML
        )
    }
}
