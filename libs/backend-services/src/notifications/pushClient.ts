import { Type, type Static } from '@sinclair/typebox'
import { TransportType } from './transports/notificationTransport.js'

export type PushClient = Static<typeof PushClient>
export const PushClient = Type.Object({
    type: Type.Enum(TransportType), // Should have been named `transport` instead of `type`
    id: Type.String()
})
