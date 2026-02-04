import { Game, GameDefinition, User } from '@tabletop/common'

export enum AccountChangeType {
    Email = 'email',
    Password = 'password',
    PasswordReset = 'passwordReset'
}

export interface EmailService {
    sendVerificationEmail(token: string, toEmail: string): Promise<void>
    sendPasswordResetEmail(token: string, url: string, toEmail: string): Promise<void>
    sendAccountChangedNotificationEmail(
        changeType: AccountChangeType,
        timestamp: Date,
        toEmail: string
    ): Promise<void>
    sendGameInvitationEmail({
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
    }): Promise<void>
    sendGameEndEmail({
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
    }): Promise<void>
}
