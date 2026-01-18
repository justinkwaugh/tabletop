import * as Type from 'typebox'
import { PieceType } from './pieceType.js'

export type CancelCube = Type.Static<typeof CancelCube>
export const CancelCube = Type.Object({
    pieceType: Type.Literal(PieceType.CancelCube)
})
