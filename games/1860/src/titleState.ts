import * as Type from 'typebox'

const Id = Type.String({ minLength: 1 })
const Amount = Type.Integer({ minimum: 0 })

/** The optional rules chosen for the game (Optional Rules). */
export const Options1860 = Type.Object(
    {
        /** Insolvent companies earn the maximum the next train could, without running it. */
        simplifiedInsolvency: Type.Optional(Type.Literal(true)),
        /** Small stations may not be passed by (Playing the Original Game). */
        noSkippingTowns: Type.Optional(Type.Literal(true)),
        /** A run may enter a hex again, using none of the track it has already used. */
        reenterHexes: Type.Optional(Type.Literal(true)),
        /** Shares of a company that has not operated sell for their full price. */
        unoperatedFullValue: Type.Optional(Type.Literal(true))
    },
    { additionalProperties: false }
)
export type Options1860 = Type.Static<typeof Options1860>

/**
 * One of the six auctions of the opening: players bid in turn, or pass and sit out, for the right
 * to choose one of the certificates still on offer (Private Companies and the Initial Auction).
 */
export const ChoiceAuction = Type.Object(
    {
        /** The player who opens this auction's bidding. */
        starterId: Id,
        /** The highest bid and its bidder, once anyone has bid. */
        bid: Type.Optional(
            Type.Object({ playerId: Id, amount: Amount }, { additionalProperties: false })
        ),
        /** Who has passed in this auction, in order. */
        passedIds: Type.Array(Id, { uniqueItems: true }),
        /** The player who won the auction and now chooses a certificate, and what they bid. */
        winner: Type.Optional(
            Type.Object({ playerId: Id, amount: Amount }, { additionalProperties: false })
        ),
        /** The certificates still on offer: privates by id, director's shares by company id. */
        lotIds: Type.Array(Id, { uniqueItems: true })
    },
    { additionalProperties: false }
)
export type ChoiceAuction = Type.Static<typeof ChoiceAuction>

/** The British Rail endgame (Railway Nationalisation). */
export const Nationalisation = Type.Object(
    {
        /** The companies closed so far, which no longer operate; their prices stand. */
        closedCompanyIds: Type.Array(Id, { uniqueItems: true }),
        /** What each company has paid out in the operating round under way. */
        dividends: Type.Record(Id, Amount),
        /** The last operating round whose closures are settled, or in which British Rail formed. */
        settledRound: Type.Optional(
            Type.Object(
                { set: Type.Integer({ minimum: 1 }), round: Type.Integer({ minimum: 1 }) },
                { additionalProperties: false }
            )
        )
    },
    { additionalProperties: false }
)
export type Nationalisation = Type.Static<typeof Nationalisation>

export const TitleFields1860 = {
    options: Options1860,
    choiceAuction: Type.Optional(ChoiceAuction),
    /** Companies that ended a turn without a train though they had a route (Insolvency). */
    insolventIds: Type.Array(Id, { uniqueItems: true }),
    /** Bankrupt companies not yet started again; their bases lie flipped (Bankrupt Companies). */
    bankruptIds: Type.Array(Id, { uniqueItems: true }),
    /** A company whose director lays its home tile, the company having just floated. */
    homeTileCompanyId: Type.Optional(Id),
    /** A stock round has begun since the Southern formed: no more track, bases or halts. */
    southernStockRound: Type.Optional(Type.Literal(true)),
    /** British Rail has formed: the game ends as companies are progressively closed. */
    nationalisation: Type.Optional(Nationalisation)
}
export type TitleState1860 = Type.Static<Type.TObject<typeof TitleFields1860>>
