import { Type, type Static } from '@sinclair/typebox'
import { GameAction } from '@tabletop/common'

export type StoredAction = Static<typeof StoredAction>
export const StoredAction = Type.Composite([
    Type.Omit(GameAction, ['createdAt', 'updatedAt', 'deletedAt']),
    Type.Object({
        strUndoPatch: Type.Optional(Type.String()),
        createdAt: Type.Any(),
        updatedAt: Type.Any(),
        deletedAt: Type.Optional(Type.Any())
    })
])
