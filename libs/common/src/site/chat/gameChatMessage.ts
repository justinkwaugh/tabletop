import * as Type from 'typebox'
import { ChatMessage } from './chatMessage.js'

export type GameChatMessage = Type.Static<typeof GameChatMessage>
export const GameChatMessage = Type.Evaluate(
    Type.Intersect([
        ChatMessage,
        Type.Object({
            playerId: Type.Optional(Type.String())
        })
    ])
)
