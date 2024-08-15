import { Type, type Static } from '@sinclair/typebox'
import { Game } from '@tabletop/common'

export type StoredGame = Static<typeof StoredGame>
export const StoredGame = Type.Composite([
    Type.Omit(Game, ['createdAt', 'updatedAt', 'deletedAt', 'startedAt', 'finishedAt']),
    Type.Object({
        userIds: Type.Array(Type.String()),
        createdAt: Type.Any(),
        updatedAt: Type.Any(),
        deletedAt: Type.Optional(Type.Any()),
        startedAt: Type.Optional(Type.Any()),
        finishedAt: Type.Optional(Type.Any()),
        lastActionAt: Type.Optional(Type.Any())
    })
])
