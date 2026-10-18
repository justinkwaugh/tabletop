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
