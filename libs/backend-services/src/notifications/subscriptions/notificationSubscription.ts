import { Static, Type } from 'typebox'
import { DiscordSubscription } from './discordSubscription.js'
import { WebPushSubscription } from './webPushSubscription.js'

export type NotificationSubscription = Static<typeof NotificationSubscription>
export const NotificationSubscription = Type.Union([DiscordSubscription, WebPushSubscription])
