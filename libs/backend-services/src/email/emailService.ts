import type {
    LeagueSeasonResultsProps,
    LeagueSeasonStartProps,
    LeagueSignUpProps
} from '@tabletop/email'
import { Game, GameDefinition, TournamentDetail, User } from '@tabletop/common'

export enum AccountChangeType {
    Email = 'email',
    Password = 'password',
    PasswordReset = 'passwordReset'
}

export type LeagueSignUpEmail = LeagueSignUpProps & { url: string; toEmail: string }

export type LeagueSeasonStartEmail = LeagueSeasonStartProps & { url: string; toEmail: string }

export type LeagueSeasonResultsEmail = LeagueSeasonResultsProps & { url: string; toEmail: string }

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
    sendTournamentResultsEmail({
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
    }): Promise<void>
    sendLeagueSignUpEmail(email: LeagueSignUpEmail): Promise<void>
    sendLeagueSeasonStartEmail(email: LeagueSeasonStartEmail): Promise<void>
    sendLeagueSeasonResultsEmail(email: LeagueSeasonResultsEmail): Promise<void>
}
