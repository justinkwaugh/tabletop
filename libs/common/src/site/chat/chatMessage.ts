import { Kind, Type, type Static } from '@sinclair/typebox'

export type ChatMessage = Static<typeof ChatMessage>
export const ChatMessage = Type.Object({
    id: Type.String(),
    userId: Type.Optional(Type.String()),
    timestamp: Type.Unsafe<Date>({ [Kind]: 'Date', format: 'date-time' }),
    text: Type.String()
})
