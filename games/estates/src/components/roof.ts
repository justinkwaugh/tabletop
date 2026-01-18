import * as Type from 'typebox'
import { PieceType } from './pieceType.js'

export type Roof = Type.Static<typeof Roof>
export const Roof = Type.Object({
    pieceType: Type.Literal(PieceType.Roof),
    value: Type.Number()
})
