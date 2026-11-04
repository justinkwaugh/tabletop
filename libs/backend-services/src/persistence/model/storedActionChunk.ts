import { Type, type Static } from 'typebox'
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
