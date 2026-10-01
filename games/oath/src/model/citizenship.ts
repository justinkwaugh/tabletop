import * as Type from 'typebox'
import { Banner } from './oathEnums.js'

/** R-6.6.1 — "any number of favor, secrets, banners and non-Reliquary relics". */
export type CitizenshipTransfer = Type.Static<typeof CitizenshipTransfer>
export const CitizenshipTransfer = Type.Object({
    favor: Type.Optional(Type.Number()),
    secrets: Type.Optional(Type.Number()),
    /** R-2.3 — non-Reliquary only; the Reliquary relic is the offer itself. */
    relicCardIds: Type.Optional(Type.Array(Type.String())),
    banners: Type.Optional(Type.Array(Type.Enum(Banner)))
})

/** R-6.6.1, R-10.8 — both directions, either may be empty; the Reliquary relic is not a term. */
export type CitizenshipTerms = Type.Static<typeof CitizenshipTerms>
export const CitizenshipTerms = Type.Object({
    fromScepterHolder: Type.Optional(CitizenshipTransfer),
    fromExile: Type.Optional(CitizenshipTransfer)
})
