import { type Static, Type } from '@sinclair/typebox'
import { TransportType } from '../transports/notificationTransport.js'
import { NotificationSubscriptionIdentifier } from './notificationSubscriptionIdentifier.js'

export type DiscordSubscription = Static<typeof DiscordSubscription>
export const DiscordSubscription = Type.Composite([
    Type.Omit(NotificationSubscriptionIdentifier, ['transport']),
    Type.Object({
        transport: Type.Literal(TransportType.Discord),
        discordUserId: Type.String()
    })
])
