import { type Static, Type } from 'typebox'
import { TransportType } from '../transports/notificationTransport.js'
import { NotificationSubscriptionIdentifier } from './notificationSubscriptionIdentifier.js'

export const WEB_PUSH_ENDPOINT_MAX_LENGTH = 2048
export const WEB_PUSH_KEY_MAX_LENGTH = 128

export type WebPushSubscription = Static<typeof WebPushSubscription>
export const WebPushSubscription = Type.Evaluate(
    Type.Intersect([
        Type.Omit(NotificationSubscriptionIdentifier, ['transport']),
        Type.Object({
            transport: Type.Literal(TransportType.WebPush),
            endpoint: Type.String({ maxLength: WEB_PUSH_ENDPOINT_MAX_LENGTH }),
            expirationTime: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
            keys: Type.Object({
                p256dh: Type.String({ maxLength: WEB_PUSH_KEY_MAX_LENGTH }),
                auth: Type.String({ maxLength: WEB_PUSH_KEY_MAX_LENGTH })
            })
        })
    ])
)

export type WebPushSubscriptionClientData = Static<typeof WebPushSubscriptionClientData>
export const WebPushSubscriptionClientData = Type.Pick(WebPushSubscription, [
    'endpoint',
    'expirationTime',
    'keys'
])
