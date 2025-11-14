import { Type, type Static } from 'typebox'
import { GameChat } from '@tabletop/common'
import { StoredGameChatMessage } from './storedGameChatMessage'

export type StoredGameChat = Static<typeof StoredGameChat>
export const StoredGameChat = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameChat, ['createdAt', 'updatedAt', 'messages']),
        Type.Object({
            messages: Type.Array(StoredGameChatMessage),
            createdAt: Type.Any(),
            updatedAt: Type.Any()
        })
    ])
)
