import * as Type from 'typebox'

/** The powers that move another player's pawn, so that Toll Roads asks the moved player. */
export enum PowerMoveKind {
    /** R-5.5.7.III */
    Banish = 'banish',
    Whistle = 'whistle',
    Palanquin = 'palanquin',
    /** R-11.7 — the ruler of the Shrouded Wood being left picks the site. */
    ShroudedWood = 'shroudedWood'
}

export enum PowerMoveTollOutcome {
    Asked = 'asked',
    Paid = 'paid',
    Refused = 'refused',
    NoFavor = 'noFavor'
}

/** R-7.1.4 — a toll given: to its payee, or burned when the bandits rule the card. */
export type PaidToll = Type.Static<typeof PaidToll>
export const PaidToll = Type.Object({
    cardId: Type.String(),
    payeeId: Type.Optional(Type.String())
})

/**
 * Toll Roads on a power's move (its Q&A): the moved player gives the favor or refuses, and a
 * refusal blocks the move. The record names everyone and every site, so a History row is
 * written from it alone.
 */
export type PowerMoveToll = Type.Static<typeof PowerMoveToll>
export const PowerMoveToll = Type.Object({
    move: Type.Enum(PowerMoveKind),
    /** The power's card: the Whistle or Palanquin. */
    powerCardId: Type.Optional(Type.String()),
    moverPlayerId: Type.String(),
    movedPlayerId: Type.String(),
    fromSiteId: Type.String(),
    toSiteId: Type.String(),
    toll: PaidToll,
    outcome: Type.Enum(PowerMoveTollOutcome),
    /** The Whistle's secret, given on arrival. */
    secretsTaken: Type.Optional(Type.Number()),
    /** R-5.5.7.III — the burn that waited on the answer. */
    favorBurned: Type.Optional(Type.Number()),
    /** R-7.1.4 (Grasping Vines, Boiling Lake) */
    notes: Type.Optional(Type.Array(Type.String(), { maxItems: 8 }))
})
