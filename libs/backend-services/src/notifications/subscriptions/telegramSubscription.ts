import { type Static, Type } from 'typebox'
import { TransportType } from '../transports/notificationTransport.js'
import { NotificationSubscriptionIdentifier } from './notificationSubscriptionIdentifier.js'

/** A private Telegram chat with the site's bot; the id is the chat id, so one chat links to one user. */
export type TelegramSubscription = Static<typeof TelegramSubscription>
export const TelegramSubscription = Type.Evaluate(
    Type.Intersect([
        Type.Omit(NotificationSubscriptionIdentifier, ['transport']),
        Type.Object({
            transport: Type.Literal(TransportType.Telegram),
            chatId: Type.String()
        })
    ])
)

export function telegramSubscriptionFor(chatId: string): TelegramSubscription {
    return { id: chatId, transport: TransportType.Telegram, chatId }
}
