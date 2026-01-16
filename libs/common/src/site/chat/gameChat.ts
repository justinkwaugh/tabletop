import * as Type from 'typebox'
import { Chat } from './chat.js'

export type GameChat = Type.Static<typeof GameChat>
export const GameChat = Type.Evaluate(
    Type.Intersect([
        Chat,
        Type.Object({
            gameId: Type.String()
        })
    ])
)
