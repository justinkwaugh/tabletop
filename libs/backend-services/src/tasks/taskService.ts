import { AccountChangeType, type RecipientLanguage } from '../email/emailService.js'
import type { ContentReportEmail } from '../moderation/contentReports.js'
import type { GameEmailTask } from '../games/gameEmails.js'

export interface CreatePushTaskOptions<T> {
    queue: string
    payload: T
    path: string
    inSeconds?: number
    uniqueName?: string
}

export type GameInvitationEmailTask = {
    userId: string
    gameId: string
    token: string
    toEmail: string
    inviteeId: string
}

export type VerificationEmailTask = { userId: string; token: string }
export type EmailChangeVerificationTask = VerificationEmailTask & { email: string }

export type AccountChangeNotice = RecipientLanguage & {
    email: string
    changeType: AccountChangeType
    timestamp: Date
    username?: string
}

export interface TaskService {
    createPushTask<T>(options: CreatePushTaskOptions<T>): Promise<void>

    sendVerificationEmail(task: VerificationEmailTask): Promise<void>
    sendEmailChangeVerificationEmail(task: EmailChangeVerificationTask): Promise<void>
    sendPasswordResetEmail({ userId, token }: { userId: string; token: string }): Promise<void>
    sendAuthVerificationEmail({ userId, token }: { userId: string; token: string }): Promise<void>
    sendAccountChangeNotificationEmail(notice: AccountChangeNotice): Promise<void>
    sendContentReportEmail(report: ContentReportEmail): Promise<void>

    sendGameInvitationEmail(task: GameInvitationEmailTask): Promise<void>

    sendGameEndEmail(task: GameEmailTask): Promise<void>

    sendGameStartedEmail(task: GameEmailTask): Promise<void>
}
