import * as Type from 'typebox'
import { Visibility } from '@tabletop/common'
import { Region } from './oathEnums.js'
import { PileDeposit } from './hidden.js'

/** R-9.4 — a relic sent to the bottom of the relic deck may be one only the actor saw. */
export const RelicToDeckBottom = Visibility.protect(Type.String(), {
    policy: Visibility.Policy.Actor
})

export type PowerOutcome = Type.Static<typeof PowerOutcome>
export const PowerOutcome = Type.Object({
    /** R-X.3(a) — the power advanced the PRNG. */
    rolled: Type.Optional(Type.Boolean()),
    relicToDeckBottom: Type.Optional(RelicToDeckBottom),
    /** Relic Breaker — the facedown relic at this slot goes to the bottom unseen; the vault moves it. */
    relicSlotToBottom: Type.Optional(Type.String()),
    /** R-X.3(c) — the power showed a player a card they had not seen (Dream Thief's swap). */
    disclosed: Type.Optional(Type.Boolean()),
    /** R-10.17 */
    peeked: Type.Optional(
        Visibility.protect(Type.Array(Type.String(), { maxItems: 64 }), {
            policy: Visibility.Policy.Actor
        })
    ),
    mergePiles: Type.Optional(Type.Object({ from: Type.Enum(Region), to: Type.Enum(Region) })),
    pileDeposits: Type.Optional(Type.Array(PileDeposit, { maxItems: 8 }))
})
