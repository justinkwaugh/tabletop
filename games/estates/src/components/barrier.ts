import * as Type from 'typebox'
import { PieceType } from './pieceType.js'

export enum BarrierDirection {
    Unplaced = 'unplaced',
    Lengthen = 'lengthen',
    Shorten = 'shorten'
}

export type Barrier = Type.Static<typeof Barrier>
export const Barrier = Type.Object({
    pieceType: Type.Literal(PieceType.Barrier),
    value: Type.Number(),
    direction: Type.Enum(BarrierDirection)
})
