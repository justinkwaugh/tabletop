import { Type, type Static } from 'typebox'
import { PushTopic } from '../../notifications/pushTopic'

export type StoredPushTopic = Static<typeof StoredPushTopic>
export const StoredPushTopic = Type.Evaluate(
    Type.Intersect([
        PushTopic,
        Type.Object({
            createdAt: Type.Optional(Type.Any()),
            updatedAt: Type.Optional(Type.Any())
        })
    ])
)
