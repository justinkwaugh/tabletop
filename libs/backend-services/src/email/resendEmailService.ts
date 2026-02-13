import { render } from '@react-email/components'
import { nanoid } from 'nanoid'
import {
    EmailVerification,
    PasswordReset,
    AccountChangeNotification,
    GameInvitation,
    GameEnd
} from '@tabletop/email'

import { Resend } from 'resend'
import { SecretsService } from '../secrets/secretsService'
import { Game, GameDefinition, User } from '@tabletop/common'
import { AccountChangeType, EmailService } from './emailService.js'
import { NullEmailService } from './nullEmailService.js'

export class ResendEmailService implements EmailService {
    private resend!: Resend
    private constructor() {}

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
        const emailHTML = await render(EmailVerification({ token }))
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
        const emailHTML = await render(PasswordReset({ url }))
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
        const emailHTML = await render(AccountChangeNotification({ changeType, timestamp }))
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
        const emailHTML = await render(
            GameInvitation({
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

        const emailHTML = await render(
            GameEnd({
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
}
