import { Static, Type } from '@sinclair/typebox'

export type NotificationSubscriptionIdentifier = Static<typeof NotificationSubscriptionIdentifier>
export const NotificationSubscriptionIdentifier = Type.Object({
    id: Type.String(),
    transport: Type.String()
})
