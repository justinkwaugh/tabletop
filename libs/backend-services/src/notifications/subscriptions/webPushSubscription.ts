import { type Static, Type } from 'typebox'
import { TransportType } from '../transports/notificationTransport.js'
import { NotificationSubscriptionIdentifier } from './notificationSubscriptionIdentifier.js'

export type WebPushSubscription = Static<typeof WebPushSubscription>
export const WebPushSubscription = Type.Evaluate(
    Type.Intersect([
        Type.Omit(NotificationSubscriptionIdentifier, ['transport']),
        Type.Object({
            transport: Type.Literal(TransportType.WebPush),
            endpoint: Type.String(),
            expirationTime: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
            keys: Type.Object({
                p256dh: Type.String(),
                auth: Type.String()
            })
        })
    ])
)
