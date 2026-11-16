import * as Type from 'typebox'
import { ScenarioId1822 } from './scenarioCatalog.js'

const Id = Type.String({ minLength: 1 })

export type DiscountTokenKind = 'terrain' | 'estuary'

/** What becomes of an exchange token as a major company acquires a minor (§5.18.6, §5.18.7). */
export const TokenChoice = Type.Union([
    Type.Literal('place'),
    Type.Literal('available'),
    Type.Literal('none')
])
export type TokenChoice1822 = Type.Static<typeof TokenChoice>

/** How a private company with a choice is taken up as it is acquired (Table 3: P5, P8). */
export const AcquisitionChoice = Type.Union([
    Type.Literal('token'),
    Type.Literal('discount'),
    Type.Literal('channel'),
    Type.Literal('upgrade'),
    Type.Literal('available')
])
export type AcquisitionChoice1822 = Type.Static<typeof AcquisitionChoice>

export const TitleFields1822 = {
    /** The options chosen before the game began (§2.1.7, §6.1). */
    variants: Type.Object(
        {
            /** The scenario played, where it is not the standard game (§6.2.1). */
            scenario: Type.Optional(ScenarioId1822),
            /** The 1822+ expansion: six more minor and three more private companies (§6.2.2). */
            plus: Type.Optional(Type.Literal(true)),
            /** No private company was removed during setup (§6.1.3). */
            allPrivates: Type.Optional(Type.Literal(true)),
            /** The private companies fill their boxes from one stack (§6.1.3). */
            mixedPrivates: Type.Optional(Type.Literal(true)),
            /** The tax haven's money buys it further shares (§6.1.2). */
            taxHavenShares: Type.Optional(Type.Literal(true))
        },
        { additionalProperties: false }
    ),
    /** The private companies removed at random during setup, which take no part (§2.1.7). */
    removedPrivateIds: Type.Optional(Type.Array(Id, { minItems: 1, uniqueItems: true })),
    /** The major and minor companies a scenario plays without (§6.2.1). */
    removedCompanyIds: Type.Optional(Type.Array(Id, { minItems: 1, uniqueItems: true })),
    /** The tax haven has bought its share this stock round; it buys one a round (§6.1.2). */
    taxHavenBought: Type.Optional(Type.Literal(true)),
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
    /**
     * The London station whose roundel space the Metropolitan Railway left with no exchange token
     * in its place, open now to any company's station (§5.10.4).
     */
    vacatedRoundelNodeId: Type.Optional(Id),
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
     * The exchange tokens each major company has taken from its charter in play, onto the map or
     * among its available tokens, and those P18 has put back; the charter prints the rest
     * (§5.6.3, §5.12.4, §5.12.7). A company that has done neither has no entry.
     */
    exchangeTokenUse: Type.Array(
        Type.Object(
            {
                companyId: Id,
                taken: Type.Optional(Type.Integer({ minimum: 1 })),
                returned: Type.Optional(Type.Integer({ minimum: 1 }))
            },
            { additionalProperties: false }
        )
    ),
    /** The company that took P8's £20 hill and mountain discount instead of its token (Table 3). */
    hillDiscountCompanyId: Type.Optional(Id),
    /**
     * P9's holder's declaration this stock round, of their cash or double it, for the turn order
     * that follows the round (§3.1.9); dropped as the round completes.
     */
    cashDeclaration: Type.Optional(
        Type.Object({ playerId: Id, doubled: Type.Boolean() }, { additionalProperties: false })
    ),
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
                token: TokenChoice,
                discardTrainIds: Type.Array(Id)
            },
            { additionalProperties: false }
        )
    ),
    /**
     * A company's request for a private company another player holds, until that player answers
     * it (§3.1.2).
     */
    privateOffer: Type.Optional(
        Type.Object(
            {
                companyId: Id,
                privateCompanyId: Id,
                /** The private company's holder, who answers. */
                playerId: Id,
                choice: Type.Optional(AcquisitionChoice),
                discardTrainId: Type.Optional(Id)
            },
            { additionalProperties: false }
        )
    ),
    /** The first stock round ended with nothing sold, which ends the game (§1.3.1). */
    nothingSold: Type.Optional(Type.Literal(true))
}
export type TitleState1822 = Type.Static<Type.TObject<typeof TitleFields1822>>
