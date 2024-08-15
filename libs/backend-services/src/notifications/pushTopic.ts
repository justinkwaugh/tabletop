import { Type, type Static } from '@sinclair/typebox'
import { PushClient } from './pushClient.js'

export type PushTopic = Static<typeof PushTopic>
export const PushTopic = Type.Object({
    topic: Type.String(),
    clients: Type.Array(PushClient)
})
