import { Notification, NotificationCategory, UserNotification } from '@tabletop/common'

import { CatalogService } from '../../games/catalogService.js'
import { LibraryService } from '../../games/libraryService.js'
import { TelegramBotApi, TelegramResult } from '../../telegram/telegramBotApi.js'
import { TelegramSubscription } from '../subscriptions/telegramSubscription.js'
import { notificationCatalogEntry } from './notificationCatalogEntry.js'
import {
    NotificationResult,
    NotificationTransport,
    TransportType
} from './notificationTransport.js'
import { telegramNotificationMessage } from './telegramNotificationMessage.js'

const FRONTEND_HOST = process.env.FRONTEND_HOST ?? ''

export class TelegramTransport implements NotificationTransport {
    type = TransportType.Telegram

    constructor(
        private readonly libraryService: LibraryService,
        private readonly catalogService: CatalogService,
        private readonly botApi: TelegramBotApi
    ) {}

    async sendNotification(
        subscription: TelegramSubscription,
        notification: Notification
    ): Promise<NotificationResult> {
        if (!isUserNotification(notification)) {
            return { success: false, unregister: false }
        }

        const catalogEntry = await notificationCatalogEntry(
            this.libraryService,
            this.catalogService,
            notification.data.game.typeId
        )
        const result = await this.botApi.sendMessage(
            telegramNotificationMessage(notification, subscription.chatId, {
                frontendHost: FRONTEND_HOST,
                gameTitle: catalogEntry?.metadata.name
            })
        )
        if (result.ok) {
            return { success: true, unregister: false }
        }

        console.error('Could not send a Telegram notification', subscription.chatId, result)
        return { success: false, unregister: isChatGone(result) }
    }
}

function isUserNotification(notification: Notification): notification is UserNotification {
    return notification.type === NotificationCategory.User
}

/** The user blocked the bot or deleted their account, or the chat no longer exists. */
export function isChatGone(result: TelegramResult<unknown>): boolean {
    if (result.ok) return false
    return (
        result.errorCode === 403 ||
        (result.errorCode === 400 && /chat not found/i.test(result.description))
    )
}
