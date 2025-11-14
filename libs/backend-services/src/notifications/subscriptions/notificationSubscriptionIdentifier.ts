import { Static, Type } from 'typebox'

export type NotificationSubscriptionIdentifier = Static<typeof NotificationSubscriptionIdentifier>
export const NotificationSubscriptionIdentifier = Type.Object({
    id: Type.String(),
    transport: Type.String()
})
