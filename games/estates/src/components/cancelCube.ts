import { Type, type Static } from 'typebox'
import { PieceType } from './pieceType.js'

export type CancelCube = Static<typeof CancelCube>
export const CancelCube = Type.Object({
    pieceType: Type.Literal(PieceType.CancelCube)
})
