import { Type, type Static } from '@sinclair/typebox'

export type ChatMessage = Static<typeof ChatMessage>
export const ChatMessage = Type.Object({
    id: Type.String(),
    userId: Type.Optional(Type.String()),
    timestamp: Type.Date(),
    text: Type.String()
})
