import { render } from '@react-email/components'
import { nanoid } from 'nanoid'
import {
    EmailVerification,
    PasswordReset,
    AccountChangeNotification,
    GameInvitation
} from '@tabletop/email'

import { Resend } from 'resend'
import { SecretsService } from '../secrets/secretsService'
import { Game, GameDefinition, User } from '@tabletop/common'

export enum AccountChangeType {
    Email = 'email',
    Password = 'password',
    PasswordReset = 'passwordReset'
}

export class EmailService {
    private resend!: Resend
    private constructor() {}

    static async createEmailService(secretsService: SecretsService): Promise<EmailService> {
        const emailService = new EmailService()
        const resendKey = await secretsService.getSecret('RESEND_API_KEY')
        emailService.resend = new Resend(resendKey)
        return emailService
    }

    async sendVerificationEmail(token: string, toEmail: string): Promise<void> {
        const emailHTML = render(EmailVerification({ token }))
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
        const emailHTML = render(PasswordReset({ url }))
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
        const emailHTML = render(AccountChangeNotification({ changeType, timestamp }))
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
        const emailHTML = render(
            GameInvitation({
                ownerName: owner.username ?? 'someone',
                gameName: game.name,
                title: definition.metadata.name,
                url
            })
        )
        await this.resend.emails.send({
            from: 'noreply@boardtogether.games',
            to: toEmail,
            subject: `Join ${owner.username}'s game of ${definition.metadata.name}`,
            html: emailHTML,
            headers: {
                'X-Entity-Ref-ID': nanoid()
            }
        })
    }
}
