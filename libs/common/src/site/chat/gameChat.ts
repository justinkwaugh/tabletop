import { Type, type Static } from '@sinclair/typebox'
import { Chat } from './chat.js'

export type GameChat = Static<typeof GameChat>
export const GameChat = Type.Composite([
    Chat,
    Type.Object({
        gameId: Type.String()
    })
])
