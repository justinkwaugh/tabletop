import { nanoid } from 'nanoid'

import { Resend } from 'resend'
import { SecretsService } from '../secrets/secretsService'
import { Game, GameDefinition, TournamentDetail, User } from '@tabletop/common'
import { AccountChangeType, EmailService } from './emailService.js'
import { NullEmailService } from './nullEmailService.js'

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
        const emailHTML = await render(templates.EmailVerification({ token }))
        await this.resend.emails.send({
            from: 'noreply@boardtogether.games',
            to: toEmail,
            subject: 'Verify your email address',
            html: emailHTML,
            headers: {
                'X-Entity-Ref-ID': nanoid()
            }
        })
    }

    async sendPasswordResetEmail(token: string, url: string, toEmail: string): Promise<void> {
        const { render, templates } = await this.loadRendering()
        const emailHTML = await render(templates.PasswordReset({ url }))
        await this.resend.emails.send({
            from: 'noreply@boardtogether.games',
            to: toEmail,
            subject: 'Reset your password',
            html: emailHTML,
            headers: {
                'X-Entity-Ref-ID': nanoid()
            }
        })
    }

    async sendAccountChangedNotificationEmail(
        changeType: AccountChangeType,
        timestamp: Date,
        toEmail: string
    ): Promise<void> {
        const { render, templates } = await this.loadRendering()
        const emailHTML = await render(
            templates.AccountChangeNotification({ changeType, timestamp })
        )
        await this.resend.emails.send({
            from: 'noreply@boardtogether.games',
            to: toEmail,
            subject: 'Account change notification',
            html: emailHTML,
            headers: {
                'X-Entity-Ref-ID': nanoid()
            }
        })
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
        await this.resend.emails.send({
            from: 'noreply@boardtogether.games',
            to: toEmail,
            subject: `Join ${owner.username}'s game of ${definition.info.metadata.name}`,
            html: emailHTML,
            headers: {
                'X-Entity-Ref-ID': nanoid()
            }
        })
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
                gameName: game.name,
                title: definition.info.metadata.name,
                url
            })
        )
        await this.resend.emails.send({
            from: 'noreply@boardtogether.games',
            to: toEmail,
            subject: `Your game of ${definition.info.metadata.name} ${game.name} has ended`,
            html: emailHTML,
            headers: {
                'X-Entity-Ref-ID': nanoid()
            }
        })
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
        const { render, templates } = await this.loadRendering()
        const emailHTML = await render(
            templates.TournamentResults({
                tournamentName: detail.tournament.name,
                title: definition.info.metadata.name,
                winners: standings.filter((row) => row.rank === 1).map((row) => name(row.userId)),
                standings: standings.map((row) => ({
                    rank: row.rank,
                    name: name(row.userId),
                    wins: row.wins,
                    score: row.score,
                    ...(row.tiebreak !== undefined ? { tiebreak: row.tiebreak } : {}),
                    recipient: row.userId === recipientId
                })),
                url
            })
        )
        await this.resend.emails.send({
            from: 'noreply@boardtogether.games',
            to: toEmail,
            subject: `Final results for ${detail.tournament.name}`,
            html: emailHTML,
            headers: {
                'X-Entity-Ref-ID': nanoid()
            }
        })
    }
}
