import { Type, type Static } from 'typebox'
import { User } from '@tabletop/common'

export type StoredUser = Static<typeof StoredUser>
export const StoredUser = Type.Evaluate(
    Type.Intersect([
        Type.Omit(User, ['createdAt', 'updatedAt', 'deletedAt']),
        Type.Object({
            cleanUsername: Type.Optional(Type.String()),
            passwordHash: Type.Optional(Type.String()),
            createdAt: Type.Any(),
            updatedAt: Type.Any(),
            deletedAt: Type.Optional(Type.Any())
        })
    ])
)
