import { Type, type Static } from '@sinclair/typebox'
import { ChatMessage } from './chatMessage.js'

export type GameChatMessage = Static<typeof GameChatMessage>
export const GameChatMessage = Type.Composite([
    ChatMessage,
    Type.Object({
        playerId: Type.Optional(Type.String())
    })
])
