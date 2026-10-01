import * as Type from 'typebox'

/** R-1.8, R-10.13 — the Empire's warbands: the Chancellor's, and a Citizen's once Citizenship replaces theirs. */
export const IMPERIAL_WARBANDS = 'imperial'

/** R-10.13 — whose warbands: an Exile's player id, or `IMPERIAL_WARBANDS`. */
export type WarbandOwner = Type.Static<typeof WarbandOwner>
export const WarbandOwner = Type.String()

/** R-10.9, R-10.13 — warbands by owner; an owner with no entry has none there. */
export type WarbandCounts = Type.Static<typeof WarbandCounts>
export const WarbandCounts = Type.Record(WarbandOwner, Type.Optional(Type.Number()))
