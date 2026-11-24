import { Static, Type } from 'typebox'
import { DiscordSubscription } from './discordSubscription.js'
import { DiscordWebhookSubscription } from './discordWebhookSubscription.js'
import { TelegramSubscription } from './telegramSubscription.js'
import { WebPushSubscription } from './webPushSubscription.js'

export type NotificationSubscription = Static<typeof NotificationSubscription>
export const NotificationSubscription = Type.Union([
    DiscordSubscription,
    DiscordWebhookSubscription,
    TelegramSubscription,
    WebPushSubscription
])
