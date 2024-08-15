import { Type, type Static } from '@sinclair/typebox'

export type StoredSubscription = Static<typeof StoredSubscription>
export const StoredSubscription = Type.Object({
    id: Type.String(),
    transport: Type.String(),
    topics: Type.Array(Type.String()),
    data: Type.String(),
    createdAt: Type.Optional(Type.Any()),
    updatedAt: Type.Optional(Type.Any())
})
