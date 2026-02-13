import { EmailService } from './emailService.js'

export class NullEmailService implements EmailService {
    async sendVerificationEmail(token: string, toEmail: string): Promise<void> {
        console.log(`EMAIL NOT CONFIGURED: Verification token: ${token} for email: ${toEmail}`)
    }

    async sendPasswordResetEmail(token: string, url: string, toEmail: string): Promise<void> {
        console.log(`EMAIL NOT CONFIGURED: Password reset token: ${token} for email: ${toEmail}`)
    }

    async sendAccountChangedNotificationEmail(): Promise<void> {
        console.log(`EMAIL NOT CONFIGURED: Account Change Notification`)
    }

    async sendGameInvitationEmail(): Promise<void> {
        console.log(`EMAIL NOT CONFIGURED: Game Invitation Email`)
    }

    async sendGameEndEmail(): Promise<void> {
        console.log(`EMAIL NOT CONFIGURED: Game End Email`)
    }
}
