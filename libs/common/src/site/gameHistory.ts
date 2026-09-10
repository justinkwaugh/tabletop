import * as Type from 'typebox'
import { Game } from '../game/model/game.js'

export const GameHistoryQuery = Type.Object(
    {
        before: Type.Optional(Type.String({ minLength: 1, maxLength: 512 }))
    },
    { additionalProperties: false }
)
export type GameHistoryQuery = Type.Static<typeof GameHistoryQuery>

export const GameHistoryPage = Type.Object({
    games: Type.Array(Game),
    nextCursor: Type.Optional(Type.String())
})
export type GameHistoryPage = Type.Static<typeof GameHistoryPage>

export const GameHistoryCursor = Type.Object(
    {
        time: Type.Integer({ minimum: 0 }),
        id: Type.String({ minLength: 1, maxLength: 256, pattern: '^[^/]+$' })
    },
    { additionalProperties: false }
)
export type GameHistoryCursor = Type.Static<typeof GameHistoryCursor>
