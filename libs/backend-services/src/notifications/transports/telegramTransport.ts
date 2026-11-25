import { isUserNotification, Notification } from '@tabletop/common'

import { TelegramBotApi, TelegramResult } from '../../telegram/telegramBotApi.js'
import { TelegramSubscription } from '../subscriptions/telegramSubscription.js'
import { NotificationCatalog, notificationCatalogEntry } from './notificationCatalogEntry.js'
import {
    NotificationResult,
    NotificationTransport,
    TransportType
} from './notificationTransport.js'
import { telegramNotificationMessage } from './telegramNotificationMessage.js'
import type { Locale } from '@tabletop/email/i18n'

export class TelegramTransport implements NotificationTransport {
    type = TransportType.Telegram

    constructor(
        private readonly catalog: NotificationCatalog,
        private readonly botApi: Pick<TelegramBotApi, 'sendMessage'>,
        private readonly frontendHost: string
    ) {}

    async sendNotification(
        subscription: TelegramSubscription,
        notification: Notification,
        locale: Locale
    ): Promise<NotificationResult> {
        if (!isUserNotification(notification)) {
            return { success: false, unregister: false }
        }

        const catalogEntry = await notificationCatalogEntry(
            this.catalog,
            notification.data.game.typeId
        )
        const result = await this.botApi.sendMessage(
            telegramNotificationMessage(notification, subscription.chatId, {
                frontendHost: this.frontendHost,
                gameTitle: catalogEntry?.metadata.name,
                locale
            })
        )
        if (result.ok) {
            return { success: true, unregister: false }
        }

        console.error('Could not send a Telegram notification', subscription.chatId, result)
        return { success: false, unregister: this.isChatGone(result) }
    }

    // 403: the user blocked the bot or deleted their account.
    private isChatGone(result: TelegramResult): boolean {
        if (result.ok) return false
        return (
            result.errorCode === 403 ||
            (result.errorCode === 400 && /chat not found/i.test(result.description))
        )
    }
}
