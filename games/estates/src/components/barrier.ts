import { Type, type Static } from '@sinclair/typebox'
import { PieceType } from './pieceType'

export type Barrier = Static<typeof Barrier>
export const Barrier = Type.Object({
    pieceType: Type.Literal(PieceType.Barrier),
    value: Type.Number()
})
