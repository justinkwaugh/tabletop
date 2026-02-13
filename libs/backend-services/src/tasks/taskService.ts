import { AccountChangeType } from '../email/emailService.js'

export interface CreatePushTaskOptions<T> {
    queue: string
    payload: T
    path: string
    inSeconds?: number
}

export interface TaskService {
    createPushTask<T>(options: CreatePushTaskOptions<T>): Promise<void>

    sendVerificationEmail({ userId, token }: { userId: string; token: string }): Promise<void>
    sendPasswordResetEmail({ userId, token }: { userId: string; token: string }): Promise<void>
    sendAuthVerificationEmail({ userId, token }: { userId: string; token: string }): Promise<void>
    sendAccountChangeNotificationEmail({
        email,
        changeType,
        timestamp
    }: {
        email: string
        changeType: AccountChangeType
        timestamp: Date
    }): Promise<void>

    sendGameInvitationEmail({
        userId,
        gameId,
        token,
        toEmail
    }: {
        userId: string
        gameId: string
        token: string
        toEmail: string
    }): Promise<void>

    sendTurnNotification({
        userId,
        gameId,
        notificationId,
        inSeconds
    }: {
        userId: string
        gameId: string
        notificationId: string
        inSeconds?: number
    }): Promise<void>

    sendGameEndEmail({
        userId,
        gameId,
        toEmail
    }: {
        userId: string
        gameId: string
        toEmail: string
    }): Promise<void>
}
