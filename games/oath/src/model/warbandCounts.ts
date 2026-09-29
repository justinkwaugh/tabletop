import * as Type from 'typebox'
import { Color } from '@tabletop/common'

/** R-10.9, R-10.13 — warbands by colour; a colour with no entry has none there. */
export type WarbandCounts = Type.Static<typeof WarbandCounts>
export const WarbandCounts = Type.Record(Type.Enum(Color), Type.Optional(Type.Number()), {
    additionalProperties: false
})
