import { UserNotification } from '@tabletop/common'
import { siteUrl } from '../../site/siteUrl.js'
import type { TelegramSendMessage } from '../../telegram/telegramBotApi.js'
import { userNotificationCopy } from './userNotificationCopy.js'
import type { Locale } from '@tabletop/email/i18n'

export type TelegramNotificationContext = {
    frontendHost: string
    gameTitle?: string
    locale: Locale
}

function escapeTelegramHtml(text: string): string {
    return text
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
}

export function telegramNotificationMessage(
    notification: UserNotification,
    chatId: string,
    context: TelegramNotificationContext
): TelegramSendMessage {
    const copy = userNotificationCopy(notification, context.locale)
    const url = siteUrl(copy.path, context.frontendHost)
    const gameLine = context.gameTitle
        ? `${escapeTelegramHtml(notification.data.game.name)} · ${escapeTelegramHtml(context.gameTitle)}`
        : escapeTelegramHtml(notification.data.game.name)

    return {
        chat_id: chatId,
        // The first line is what a phone's notification banner shows.
        text: `<b>${escapeTelegramHtml(copy.heading)}</b>\n${gameLine}`,
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
        reply_markup: { inline_keyboard: [[{ text: copy.buttonLabel, url }]] }
    }
}
