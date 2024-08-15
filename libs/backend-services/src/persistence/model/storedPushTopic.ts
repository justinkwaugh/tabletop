import { Type, type Static } from '@sinclair/typebox'
import { PushTopic } from '../../notifications/pushTopic'

export type StoredPushTopic = Static<typeof StoredPushTopic>
export const StoredPushTopic = Type.Composite([
    PushTopic,
    Type.Object({
        createdAt: Type.Optional(Type.Any()),
        updatedAt: Type.Optional(Type.Any())
    })
])
