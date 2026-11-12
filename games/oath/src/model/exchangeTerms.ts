import * as Type from 'typebox'
import { Visibility } from '@tabletop/common'

// R-10.8, R-7.6.3-H1 — a binding exchange's terms, read by the questions that offer one and by the power choice that
// proposes one.

/** R-7.6.3-H1 — an offer's promises are its two players' until it is accepted. */
export const ExchangePartyPolicy = 'oath.exchangeParty'

/** Deed Writer — a site changing hands. */
export type SiteTransfer = Type.Static<typeof SiteTransfer>
export const SiteTransfer = Type.Object({
    siteId: Type.String(),
    /** "new ruler moves warbands from board" — how many the receiver moves in. */
    warbands: Type.Number()
})

/** R-10.8, R-7.6.3-H1 — one side of a binding exchange. */
export type ExchangeTransfer = Type.Static<typeof ExchangeTransfer>
export const ExchangeTransfer = Type.Object({
    favor: Type.Optional(Type.Number()),
    secrets: Type.Optional(Type.Number()),
    relicCardIds: Type.Optional(Type.Array(Type.String(), { maxItems: 16 })),
    /** Deed Writer only. */
    sites: Type.Optional(Type.Array(SiteTransfer, { maxItems: 8 })),
    /** The Gathering and Festival District — rows of the giver's public adviser list, so a facedown card is never named (R-9.4). */
    adviserRows: Type.Optional(
        Type.Array(Type.Integer({ minimum: 0, maximum: 15 }), { maxItems: 8 })
    )
})

/** R-7.6.3-H1 — a promise of a later action as its player wrote it, counted in UTF-16 units. */
export const PROMISE_MAX_LENGTH = 200
export const PromiseText = Type.String({ minLength: 1, maxLength: PROMISE_MAX_LENGTH })

export type ExchangeTerms = Type.Static<typeof ExchangeTerms>
export const ExchangeTerms = Type.Object({
    fromProposer: Type.Optional(ExchangeTransfer),
    fromCounterparty: Type.Optional(ExchangeTransfer),
    /**
     * R-7.6.3-H1 — each side's promise, the Tribunal's only, from revision 28. The engine records them
     * and enforces none, and only the two players read them until the deal is accepted. The object is
     * present only with a promise in it, so its presence says there is one without reading the words.
     */
    promises: Type.Optional(
        Type.Object({
            fromProposer: Type.Optional(
                Visibility.protect(PromiseText, { policy: ExchangePartyPolicy })
            ),
            fromCounterparty: Type.Optional(
                Visibility.protect(PromiseText, { policy: ExchangePartyPolicy })
            )
        })
    )
})
