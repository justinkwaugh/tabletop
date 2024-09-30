import { Type, type Static } from '@sinclair/typebox'
import { PieceType } from './pieceType.js'

export type CancelCube = Static<typeof CancelCube>
export const CancelCube = Type.Object({
    pieceType: Type.Literal(PieceType.CancelCube)
})
