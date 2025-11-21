import { Type, type Static } from 'typebox'
import { PieceType } from './pieceType.js'

export type Mayor = Static<typeof Mayor>
export const Mayor = Type.Object({
    pieceType: Type.Literal(PieceType.Mayor)
})
