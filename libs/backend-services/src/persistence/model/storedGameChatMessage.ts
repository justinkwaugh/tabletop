import { Type, type Static } from 'typebox'
import { GameChatMessage } from '@tabletop/common'

export type StoredGameChatMessage = Static<typeof StoredGameChatMessage>
export const StoredGameChatMessage = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameChatMessage, ['timestamp']),
        Type.Object({
            timestamp: Type.Any()
        })
    ])
)
