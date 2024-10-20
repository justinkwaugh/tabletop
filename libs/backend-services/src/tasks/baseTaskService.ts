import { AccountChangeType } from '../email/emailService.js'
import { CreatePushTaskOptions, TaskService } from './taskService'

export abstract class BaseTaskService implements TaskService {
    abstract createPushTask<T>(options: CreatePushTaskOptions<T>): Promise<void>

    async sendVerificationEmail({ userId, token }: { userId: string; token: string }) {
        await this.createPushTask({
            queue: 'verification-email',
            path: '/email/sendVerificationEmail',
            payload: { userId, token }
        })
    }

    async sendPasswordResetEmail({ userId, token }: { userId: string; token: string }) {
        await this.createPushTask({
            queue: 'password-reset-email',
            path: '/email/sendPasswordResetEmail',
            payload: { userId, token }
        })
    }

    async sendAuthVerificationEmail({ userId, token }: { userId: string; token: string }) {
        await this.createPushTask({
            queue: 'verification-email',
            path: '/email/sendAuthVerificationEmail',
            payload: { userId, token }
        })
    }

    async sendAccountChangeNotificationEmail({
        email,
        changeType,
        timestamp
    }: {
        email: string
        changeType: AccountChangeType
        timestamp: Date
    }) {
        await this.createPushTask({
            queue: 'account-notification-email',
            path: '/email/sendAccountChangedNotificationEmail',
            payload: { email, changeType, timestamp }
        })
    }

    async sendGameInvitationEmail({
        userId,
        gameId,
        token,
        toEmail
    }: {
        userId: string
        gameId: string
        token: string
        toEmail: string
    }) {
        await this.createPushTask({
            queue: 'invitation-email',
            path: '/email/sendGameInvitationEmail',
            payload: { userId, gameId, token, toEmail }
        })
    }

    async sendTurnNotification({
        userId,
        gameId,
        notificationId
    }: {
        userId: string
        gameId: string
        notificationId: string
    }): Promise<void> {
        await this.createPushTask({
            queue: 'turn-notification',
            path: '/notification/sendTurnNotification',
            inSeconds: 60,
            payload: { userId, gameId, notificationId }
        })
    }
}
