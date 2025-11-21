import { DateType } from '../../util/typebox.js'
import { Type, type Static } from 'typebox'

export type ChatMessage = Static<typeof ChatMessage>
export const ChatMessage = Type.Object({
    id: Type.String(),
    userId: Type.Optional(Type.String()),
    timestamp: DateType(),
    text: Type.String()
})
