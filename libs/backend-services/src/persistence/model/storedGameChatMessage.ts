import { Type, type Static } from '@sinclair/typebox'
import { GameChatMessage } from '@tabletop/common'

export type StoredGameChatMessage = Static<typeof StoredGameChatMessage>
export const StoredGameChatMessage = Type.Composite([
    Type.Omit(GameChatMessage, ['timestamp']),
    Type.Object({
        timestamp: Type.Any()
    })
])
