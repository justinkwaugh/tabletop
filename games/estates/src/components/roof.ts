import { Type, type Static } from '@sinclair/typebox'
import { PieceType } from './pieceType.js'

export type Roof = Static<typeof Roof>
export const Roof = Type.Object({
    pieceType: Type.Literal(PieceType.Roof),
    value: Type.Number()
})
