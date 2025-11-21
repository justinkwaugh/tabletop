import { Type, type Static } from 'typebox'
import { ChatMessage } from './chatMessage.js'

export type Chat = Static<typeof Chat>
export const Chat = Type.Object({
    id: Type.String(),
    checksum: Type.Number(),
    messages: Type.Array(ChatMessage)
})
