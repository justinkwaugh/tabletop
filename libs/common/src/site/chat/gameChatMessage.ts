import { Type, Static } from '@sinclair/typebox'
import { ChatMessage } from './chatMessage.js'

export type GameChatMessage = Static<typeof ChatMessage>
export const GameChatMessage = Type.Composite([
    ChatMessage,
    Type.Object({
        playerId: Type.Optional(Type.String())
    })
])
