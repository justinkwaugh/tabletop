import * as Type from 'typebox'

const Id = Type.String({ minLength: 1 })

export type DiscountTokenKind = 'terrain' | 'estuary'

export const TitleFields1822 = {
    /** What each player owes on loans taken to buy a train, interest included (§4.2, §5.17.2). */
    playerLoans: Type.Array(
        Type.Object(
            { playerId: Id, amount: Type.Integer({ minimum: 1 }) },
            { additionalProperties: false }
        )
    ),
    /**
     * Companies whose first operating turn falls in the current operating round, in which none of
     * them takes part in an acquisition (§5.18.1).
     */
    debutCompanyIds: Type.Array(Id, { uniqueItems: true }),
    /** The LNWR has joined London to Manchester, so its Manchester station is its destination (§5.11.3). */
    lnwrConnected: Type.Optional(Type.Literal(true)),
    /**
     * Discount tokens a company holds from a private company: P8's, paying for one lay on rough,
     * hill or mountain terrain, and P10's two, each paying for one estuary crossing (Table 3).
     */
    discountTokens: Type.Array(
        Type.Object(
            {
                companyId: Id,
                kind: Type.Union([Type.Literal('terrain'), Type.Literal('estuary')]),
                count: Type.Integer({ minimum: 1 })
            },
            { additionalProperties: false }
        )
    ),
    /**
     * The exchange tokens left on each major company's charter, which reach the map only through
     * an acquisition or a private company (§5.6.3, §5.12.7).
     */
    exchangeTokens: Type.Array(
        Type.Object(
            { companyId: Id, count: Type.Integer({ minimum: 1 }) },
            { additionalProperties: false }
        )
    ),
    /** The company that took P8's £20 hill and mountain discount instead of its token (Table 3). */
    hillDiscountCompanyId: Type.Optional(Id),
    /**
     * P9's holder declared double their cash for the turn order that follows the stock round
     * (§3.1.9), and the round they made their declaration in.
     */
    doubledCashPlayerId: Type.Optional(Id),
    cashDeclarationRound: Type.Optional(Type.Integer({ minimum: 1 })),
    /**
     * A major company's offer for a minor company another player directs, until that director
     * answers it (§5.18.1).
     */
    acquisitionOffer: Type.Optional(
        Type.Object(
            {
                companyId: Id,
                minorId: Id,
                /** The minor company's director, who answers. */
                playerId: Id,
                shares: Type.Integer({ minimum: 0 }),
                token: Type.Union([
                    Type.Literal('place'),
                    Type.Literal('available'),
                    Type.Literal('none')
                ]),
                discardTrainIds: Type.Array(Id)
            },
            { additionalProperties: false }
        )
    ),
    /** The first stock round ended with nothing sold, which ends the game (§1.3.1). */
    nothingSold: Type.Optional(Type.Literal(true)),
    /**
     * A company's stock value reached the game end value during a stock round, so the game ends
     * after the first operating round that follows (§1.3.1).
     */
    endsAfterNextOperatingRound: Type.Optional(Type.Literal(true))
}
export type TitleState1822 = Type.Static<Type.TObject<typeof TitleFields1822>>
