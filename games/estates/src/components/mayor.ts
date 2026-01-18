import * as Type from 'typebox'
import { PieceType } from './pieceType.js'

export type Mayor = Type.Static<typeof Mayor>
export const Mayor = Type.Object({
    pieceType: Type.Literal(PieceType.Mayor)
})
