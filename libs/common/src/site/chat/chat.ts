import * as Type from 'typebox'
import { ChatMessage } from './chatMessage.js'

export type Chat = Type.Static<typeof Chat>
export const Chat = Type.Object({
    id: Type.String(),
    checksum: Type.Number(),
    messages: Type.Array(ChatMessage)
})
