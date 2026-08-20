import * as Type from 'typebox'
import { Color } from '@tabletop/common'

// A region is a fully-enclosed area of the board. If ownerColor is unset, it's a
// "neutral zone" - enclosed by walls but with no castle inside, per the rulebook.
export type Region = Type.Static<typeof Region>
export const Region = Type.Object({
    id: Type.String(),
    ownerColor: Type.Optional(Type.Enum(Color)),
    squareKeys: Type.Array(Type.String()),
    castleSquareKey: Type.Optional(Type.String())
})
