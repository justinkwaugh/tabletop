import { DateType } from '../../util/typebox.js'
import * as Type from 'typebox'

export type ChatMessage = Type.Static<typeof ChatMessage>
export const ChatMessage = Type.Object({
    id: Type.String(),
    userId: Type.Optional(Type.String()),
    timestamp: DateType(),
    text: Type.String()
})
