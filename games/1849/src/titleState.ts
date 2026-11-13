import * as Type from 'typebox'

const Id = Type.String({ minLength: 1 })

export const TitleFields1849 = {
    /** The options chosen before the game began (§2.2, §1.1, §14). */
    variants: Type.Object(
        {
            fiveCorporations: Type.Optional(Type.Literal(true)),
            delayIft: Type.Optional(Type.Literal(true)),
            /** Corporations may issue a single L. 500 bond (§14.2). */
            bonds: Type.Optional(Type.Literal(true)),
            /** Corporations may buy station tokens from one another (§14.1). */
            buyStationTokens: Type.Optional(Type.Literal(true)),
            /** E tokens and E trains, with both other variants (§14.3). */
            electricDreams: Type.Optional(Type.Literal(true))
        },
        { additionalProperties: false }
    ),
    /**
     * The order corporations become available in (§2.2): dealt at setup, the Garibaldi moved to
     * the end when set aside for want of a home (§9.4.1), closed corporations last (§11).
     */
    corporationOrder: Type.Array(Id, { uniqueItems: true }),
    /**
     * The Garibaldi is set aside: none of its cities had room as a stock round began, so it may
     * not start until one began with room (§9.4.1).
     */
    garibaldiAside: Type.Optional(Type.Literal(true)),
    /** The station token bought this turn, which allows one a turn (§14.1). */
    stationPurchase: Type.Optional(
        Type.Object(
            {
                companyId: Id,
                operatingSet: Type.Integer({ minimum: 1 }),
                round: Type.Integer({ minimum: 1 })
            },
            { additionalProperties: false }
        )
    ),
    /** The corporation left out of a five-corporation game (§2.2). */
    removedCorporationId: Type.Optional(Id),
    /** Closed corporations and the stock round from which each may start again (§11). */
    restarts: Type.Array(
        Type.Object(
            { companyId: Id, stockRound: Type.Integer({ minimum: 1 }) },
            { additionalProperties: false }
        )
    ),
    /**
     * The corporation whose president's certificate came with the Reale Società d'Affari, whose
     * first train closes it; cleared if the corporation closes first (§8.1).
     */
    royalCompanyId: Type.Optional(Id),
    /** That corporation, until the bank funds it as it floats (§8.1). */
    royalFunding: Type.Optional(Id),
    /** The stock round each started corporation floated in; it issues no shares in its first operating round (§10.8). */
    floats: Type.Array(
        Type.Object(
            { companyId: Id, stockRound: Type.Integer({ minimum: 0 }) },
            { additionalProperties: false }
        )
    ),
    /** The bank loans each player took in emergency money raising (§10.7). */
    loans: Type.Array(
        Type.Object(
            { playerId: Id, count: Type.Integer({ minimum: 1 }) },
            { additionalProperties: false }
        )
    ),
    /** Messina may not be upgraded until this stock round, the next after the earthquake, ends (§12). */
    messinaLockedUntil: Type.Optional(Type.Integer({ minimum: 1 })),
    /** The corporation that put the +L. 20 token on a port, and the port (§7.1). */
    portBonus: Type.Optional(
        Type.Object({ companyId: Id, locationId: Id }, { additionalProperties: false })
    ),
    /**
     * The turn a corporation used the SMS, in place of its tile and token steps: it places no
     * other station that turn (§7.1).
     */
    marittimaTurn: Type.Optional(
        Type.Object(
            {
                companyId: Id,
                operatingSet: Type.Integer({ minimum: 1 }),
                operatingRound: Type.Integer({ minimum: 1 })
            },
            { additionalProperties: false }
        )
    )
}
export type TitleState1849 = Type.Static<Type.TObject<typeof TitleFields1849>>
