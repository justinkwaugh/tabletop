import * as Type from 'typebox'
import { PieceOwner } from './owner.js'

// A region is a fully-enclosed area of the board. If owner is unset, it's a
// "neutral zone" - enclosed by walls but with no castle inside, per the rulebook.
// A region owned by the neutral prince is NOT a neutral zone: it has NEUTRAL_OWNER.
export type Region = Type.Static<typeof Region>
export const Region = Type.Object({
    id: Type.String(),
    owner: Type.Optional(PieceOwner),
    squareKeys: Type.Array(Type.String()),
    castleSquareKey: Type.Optional(Type.String())
})
