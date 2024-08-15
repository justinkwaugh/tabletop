import { Type, type Static } from '@sinclair/typebox'
import { User } from '@tabletop/common'

export type StoredUser = Static<typeof StoredUser>
export const StoredUser = Type.Composite([
    Type.Omit(User, ['createdAt', 'updatedAt', 'deletedAt']),
    Type.Object({
        cleanUsername: Type.Optional(Type.String()),
        passwordHash: Type.Optional(Type.String()),
        createdAt: Type.Any(),
        updatedAt: Type.Any(),
        deletedAt: Type.Optional(Type.Any())
    })
])
