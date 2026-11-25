import { EmailService, type EmailRecipient } from './emailService.js'

export class NullEmailService implements EmailService {
    async sendVerificationEmail(token: string, to: EmailRecipient): Promise<void> {
        console.log(`EMAIL NOT CONFIGURED: Verification token: ${token} for email: ${to.email}`)
    }

    async sendPasswordResetEmail(token: string, url: string, to: EmailRecipient): Promise<void> {
        console.log(`EMAIL NOT CONFIGURED: Password reset token: ${token} for email: ${to.email}`)
    }

    async sendAccountChangedNotificationEmail(): Promise<void> {
        console.log(`EMAIL NOT CONFIGURED: Account Change Notification`)
    }

    async sendGameInvitationEmail(): Promise<void> {
        console.log(`EMAIL NOT CONFIGURED: Game Invitation Email`)
    }

    async sendContentReportEmail(): Promise<void> {
        console.log(`EMAIL NOT CONFIGURED: Content Report Email`)
    }

    async sendPlayerRemovedEmail(): Promise<void> {
        console.log(`EMAIL NOT CONFIGURED: Player Removed Email`)
    }

    async sendGameEndEmail(): Promise<void> {
        console.log(`EMAIL NOT CONFIGURED: Game End Email`)
    }

    async sendGameStartedEmail(): Promise<void> {
        console.log(`EMAIL NOT CONFIGURED: Game Started Email`)
    }

    async sendTournamentResultsEmail(): Promise<void> {
        console.log(`EMAIL NOT CONFIGURED: Tournament Results Email`)
    }

    async sendLeagueSignUpEmail(): Promise<void> {
        console.log(`EMAIL NOT CONFIGURED: League Sign-up Email`)
    }

    async sendLeagueSeasonStartEmail(): Promise<void> {
        console.log(`EMAIL NOT CONFIGURED: League Season Start Email`)
    }

    async sendLeagueSeasonResultsEmail(): Promise<void> {
        console.log(`EMAIL NOT CONFIGURED: League Season Results Email`)
    }
}
