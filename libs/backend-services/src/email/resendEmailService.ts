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
    standingsTiebreakRule,
    User
} from '@tabletop/common'
import {
    AccountChangeType,
    EmailService,
    type EmailRecipient,
    type GameStartedEmail,
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

    async sendVerificationEmail(token: string, to: EmailRecipient): Promise<void> {
        const { render, templates } = await this.loadRendering()
        const { locale } = to
        const emailHTML = await render(
            templates.EmailVerification({
                token,
                expiresInMinutes: CHALLENGE_LIFETIME_MINUTES,
                locale
            })
        )
        await this.send(to.email, templates.m.email_verification_subject({}, { locale }), emailHTML)
    }

    async sendPasswordResetEmail(token: string, url: string, to: EmailRecipient): Promise<void> {
        const { render, templates } = await this.loadRendering()
        const { locale } = to
        const emailHTML = await render(
            templates.PasswordReset({ url, expiresInMinutes: CHALLENGE_LIFETIME_MINUTES, locale })
        )
        await this.send(
            to.email,
            templates.m.email_password_reset_subject({}, { locale }),
            emailHTML
        )
    }

    async sendAccountChangedNotificationEmail(
        changeType: AccountChangeType,
        timestamp: Date,
        to: EmailRecipient,
        username?: string
    ): Promise<void> {
        const { render, templates } = await this.loadRendering()
        const { locale, timeZone } = to
        const emailHTML = await render(
            templates.AccountChangeNotification({
                changeType,
                timestamp,
                username,
                locale,
                timeZone
            })
        )
        await this.send(
            to.email,
            templates.m.email_account_change_subject({}, { locale }),
            emailHTML
        )
    }

    async sendGameInvitationEmail({
        owner,
        game,
        definition,
        url,
        to
    }: {
        owner: User
        game: Game
        definition: GameDefinition
        url: string
        to: EmailRecipient
    }): Promise<void> {
        const { render, templates } = await this.loadRendering()
        const { locale } = to
        const ownerName =
            owner.username ?? templates.m.email_game_invitation_unnamed_owner({}, { locale })
        const title = definition.info.metadata.name
        const emailHTML = await render(
            templates.GameInvitation({ ownerName, gameName: game.name, title, url, locale })
        )
        await this.send(
            to.email,
            templates.m.email_game_invitation_subject({ owner: ownerName, title }, { locale }),
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
        to,
        deletedAccount
    }: {
        playerName: string
        game: Game
        definition: GameDefinition
        url: string
        to: EmailRecipient
        deletedAccount: boolean
    }): Promise<void> {
        const { render, templates } = await this.loadRendering()
        const { locale } = to
        const emailHTML = await render(
            templates.PlayerRemoved({
                playerName,
                title: definition.info.metadata.name,
                gameName: game.name,
                url,
                deletedAccount,
                locale
            })
        )
        const subject = deletedAccount
            ? templates.m.email_player_removed_subject_left({ game: game.name }, { locale })
            : templates.m.email_player_removed_subject_removed({ game: game.name }, { locale })
        await this.send(to.email, subject, emailHTML)
    }

    async sendGameEndEmail({
        winners,
        game,
        definition,
        url,
        to
    }: {
        winners: User[]
        game: Game
        definition: GameDefinition
        url: string
        to: EmailRecipient
    }): Promise<void> {
        if (!game.result) {
            console.log('Game result is missing for game end email')
            return
        }

        const { render, templates } = await this.loadRendering()
        const { locale } = to
        const title = definition.info.metadata.name
        const emailHTML = await render(
            templates.GameEnd({
                result: game.result,
                winners: winners.map(
                    (w) => w.username || templates.m.email_unnamed_player({}, { locale })
                ),
                callKind: game.call?.kind,
                gameName: game.name,
                title,
                url,
                locale
            })
        )
        await this.send(
            to.email,
            templates.m.email_game_end_subject({ title, game: game.name }, { locale }),
            emailHTML
        )
    }

    async sendGameStartedEmail({ to, ...props }: GameStartedEmail): Promise<void> {
        const { render, templates } = await this.loadRendering()
        const { locale } = to
        const emailHTML = await render(templates.GameStarted({ ...props, locale }))
        await this.send(
            to.email,
            templates.m.email_game_started_subject(
                { game: props.gameName, title: props.title },
                { locale }
            ),
            emailHTML
        )
    }

    async sendTournamentResultsEmail({
        detail,
        definition,
        recipientId,
        url,
        to
    }: {
        detail: TournamentDetail
        definition: GameDefinition
        recipientId: string
        url: string
        to: EmailRecipient
    }): Promise<void> {
        const standings = detail.standings ?? []
        if (detail.tournament.status !== 'finished' || !standings.length) {
            console.log('Tournament results are unavailable for results email')
            return
        }
        const { render, templates } = await this.loadRendering()
        const { locale } = to
        const name = (userId: string) =>
            detail.usernames[userId] ?? templates.m.email_unnamed_player({}, { locale })
        const ranked = standings.filter((row) => !row.withdrawn)
        const tiebreaks = formatTournamentTiebreaks(ranked, locale)
        const emailHTML = await render(
            templates.TournamentResults({
                tournamentName: detail.tournament.name,
                title: definition.info.metadata.name,
                winners: standings.filter((row) => row.champion).map((row) => name(row.userId)),
                tiebreakRule: standingsTiebreakRule(standings),
                ranksByAveragePlace: ranksByAveragePlace(detail.tournament.rules),
                standings: ranked.map((row, index) => ({
                    rank: row.rank,
                    name: name(row.playedBy ?? row.userId),
                    wins: row.wins,
                    score: row.score,
                    averagePlace: formatTournamentAveragePlace(row, locale),
                    tiebreak: tiebreaks[index],
                    recipient: (row.playedBy ?? row.userId) === recipientId,
                    champion: row.champion === true
                })),
                url,
                locale
            })
        )
        await this.send(
            to.email,
            templates.m.email_tournament_results_subject(
                { tournament: detail.tournament.name },
                { locale }
            ),
            emailHTML
        )
    }

    async sendLeagueSignUpEmail({ to, ...props }: LeagueSignUpEmail): Promise<void> {
        const { render, templates } = await this.loadRendering()
        const { locale, timeZone } = to
        const emailHTML = await render(templates.LeagueSignUp({ ...props, locale, timeZone }))
        await this.send(
            to.email,
            props.reminder
                ? templates.m.email_league_sign_up_subject_reminder(
                      { league: props.leagueName },
                      { locale }
                  )
                : templates.m.email_league_sign_up_subject_open(
                      { league: props.leagueName, season: props.seasonNumber },
                      { locale }
                  ),
            emailHTML
        )
    }

    async sendLeagueSeasonStartEmail({ to, ...props }: LeagueSeasonStartEmail): Promise<void> {
        const { render, templates } = await this.loadRendering()
        const { locale } = to
        const emailHTML = await render(templates.LeagueSeasonStart({ ...props, locale }))
        await this.send(
            to.email,
            templates.m.email_league_season_start_subject(
                { league: props.leagueName, season: props.seasonNumber },
                { locale }
            ),
            emailHTML
        )
    }

    async sendLeagueSeasonResultsEmail({ to, ...props }: LeagueSeasonResultsEmail): Promise<void> {
        const { render, templates } = await this.loadRendering()
        const { locale } = to
        const emailHTML = await render(templates.LeagueSeasonResults({ ...props, locale }))
        await this.send(
            to.email,
            templates.m.email_league_season_results_subject(
                {
                    league: props.leagueName,
                    season: templates.leagueSeasonResultsName({ ...props, locale })
                },
                { locale }
            ),
            emailHTML
        )
    }
}
