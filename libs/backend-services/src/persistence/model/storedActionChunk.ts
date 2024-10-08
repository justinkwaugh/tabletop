import { Type, type Static } from '@sinclair/typebox'
import { GameAction } from '@tabletop/common'

export type ActionChunk = Static<typeof ActionChunk>
export const ActionChunk = Type.Object({
    id: Type.String(),
    gameId: Type.String(),
    createdAt: Type.Optional(Type.Any()),
    updatedAt: Type.Optional(Type.Any()),
    startIndex: Type.Number(),
    endIndex: Type.Number(),
    actions: Type.Array(GameAction)
})

export type StoredActionChunk = Static<typeof StoredActionChunk>
export const StoredActionChunk = Type.Composite([
    Type.Omit(ActionChunk, ['actions']),
    Type.Object({
        actions: Type.Optional(Type.Array(GameAction)),
        actionsData: Type.String(), // JSON stringified array of GameAction
        actionIds: Type.Array(Type.String())
    })
])
