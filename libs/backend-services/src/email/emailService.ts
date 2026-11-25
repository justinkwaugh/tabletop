import type {
    GameStartedProps,
    LeagueSeasonResultsProps,
    LeagueSeasonStartProps,
    LeagueSignUpProps
} from '@tabletop/email'
import { messageLocale, type Locale } from '@tabletop/email/i18n'
import {
    type AccountChangeType,
    Game,
    GameDefinition,
    TournamentDetail,
    User
} from '@tabletop/common'

export { AccountChangeType } from '@tabletop/common'
import type { ContentReportEmail } from '../moderation/contentReports.js'

export type RecipientLanguage = {
    locale: Locale
    timeZone?: string
}

export type EmailRecipient = RecipientLanguage & { email: string }

export function recipientLanguage(
    user: Pick<User, 'preferences' | 'seenLocale' | 'timeZone'> | undefined
): RecipientLanguage {
    return {
        locale: messageLocale(user),
        ...(user?.timeZone ? { timeZone: user.timeZone } : {})
    }
}

export function emailRecipient(
    email: string,
    user: Pick<User, 'preferences' | 'seenLocale' | 'timeZone'> | undefined
): EmailRecipient {
    return { email, ...recipientLanguage(user) }
}

type RecipientProps<Props> = Omit<Props, 'locale' | 'timeZone'> & { to: EmailRecipient }

export type GameStartedEmail = RecipientProps<GameStartedProps> & {
    url: string
    notificationsUrl: string
}

export type LeagueSignUpEmail = RecipientProps<LeagueSignUpProps> & { url: string }

export type LeagueSeasonStartEmail = RecipientProps<LeagueSeasonStartProps> & { url: string }

export type LeagueSeasonResultsEmail = RecipientProps<LeagueSeasonResultsProps> & { url: string }

export interface EmailService {
    sendVerificationEmail(token: string, to: EmailRecipient): Promise<void>
    sendPasswordResetEmail(token: string, url: string, to: EmailRecipient): Promise<void>
    sendAccountChangedNotificationEmail(
        changeType: AccountChangeType,
        timestamp: Date,
        to: EmailRecipient,
        username?: string
    ): Promise<void>
    sendGameInvitationEmail({
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
    }): Promise<void>
    sendContentReportEmail(report: ContentReportEmail): Promise<void>
    sendPlayerRemovedEmail(email: {
        playerName: string
        game: Game
        definition: GameDefinition
        url: string
        to: EmailRecipient
        deletedAccount: boolean
    }): Promise<void>
    sendGameEndEmail({
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
    }): Promise<void>
    sendGameStartedEmail(email: GameStartedEmail): Promise<void>
    sendTournamentResultsEmail({
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
    }): Promise<void>
    sendLeagueSignUpEmail(email: LeagueSignUpEmail): Promise<void>
    sendLeagueSeasonStartEmail(email: LeagueSeasonStartEmail): Promise<void>
    sendLeagueSeasonResultsEmail(email: LeagueSeasonResultsEmail): Promise<void>
}
