import * as Type from 'typebox'

const Id = Type.String({ minLength: 1 })

export const ProtectingPriceState = 'ProtectingPrice'
export const ConsentingRedemptionState = 'ConsentingRedemption'

export const RevenueTokenKind = Type.Union([
    Type.Literal('port'),
    Type.Literal('cotton'),
    Type.Literal('key-west')
])
export type RevenueTokenKind = Type.Static<typeof RevenueTokenKind>

/** An operating round, by set and round within the set. */
export const OperatingTurn = Type.Object(
    { set: Type.Integer({ minimum: 1 }), round: Type.Integer({ minimum: 1 }) },
    { additionalProperties: false }
)
export type OperatingTurn = Type.Static<typeof OperatingTurn>

/** A Port, Cotton or Key West token on the map, and the operating round it was placed in. */
export const RevenueToken = Type.Object(
    { kind: RevenueTokenKind, companyId: Id, locationId: Id, nodeId: Id, placed: OperatingTurn },
    { additionalProperties: false }
)
export type RevenueToken = Type.Static<typeof RevenueToken>

/** One company's shares a player sold, which its president may buy back at the sale price. */
export const ProtectableSale = Type.Object(
    {
        companyId: Id,
        shares: Type.Integer({ minimum: 1 }),
        proceeds: Type.Integer({ minimum: 1 }),
        certificateIds: Type.Array(Id, { minItems: 1 }),
        fromMarketSpaceId: Id,
        fromStackIndex: Type.Integer({ minimum: 0 })
    },
    { additionalProperties: false }
)
export type ProtectableSale = Type.Static<typeof ProtectableSale>

/**
 * A seller's sales awaiting their presidents' decisions, in the order sold, the presidents who
 * protected, and the state and players play returns to (§5.9).
 */
export const PriceProtection = Type.Object(
    {
        sellerPlayerId: Id,
        sales: Type.Array(ProtectableSale),
        /** Each space sold from, its stack as it stood before the seller's first sale from it. */
        stacks: Type.Array(
            Type.Object(
                { spaceId: Id, companyIds: Type.Array(Id) },
                { additionalProperties: false }
            )
        ),
        protectorIds: Type.Array(Id),
        resume: Type.Optional(
            Type.Object(
                { machineState: Id, activePlayerIds: Type.Array(Id) },
                { additionalProperties: false }
            )
        )
    },
    { additionalProperties: false }
)
export type PriceProtection = Type.Static<typeof PriceProtection>

/** A redemption from another player's holding, awaiting their consent (§5.10.4). */
export const RedemptionRequest = Type.Object(
    { companyId: Id, certificateId: Id, holderPlayerId: Id, presidentPlayerId: Id },
    { additionalProperties: false }
)
export type RedemptionRequest = Type.Static<typeof RedemptionRequest>

const StockRoundNumber = Type.Integer({ minimum: 1 })

export const EighteenThirtyTwoTitleFields = {
    priceProtection: Type.Optional(PriceProtection),
    /** Each company's redemptions in its latest stock round with one (§5.10.1). */
    redemptions: Type.Optional(
        Type.Record(
            Id,
            Type.Object(
                { stockRound: StockRoundNumber, count: Type.Integer({ minimum: 1 }) },
                { additionalProperties: false }
            )
        )
    ),
    redemptionRequest: Type.Optional(RedemptionRequest),
    /** Holders who refused a redemption on the turn beginning at an action (§5.10.4). */
    redemptionRefusals: Type.Optional(
        Type.Object(
            { turnStart: Type.Integer({ minimum: 0 }), playerIds: Type.Array(Id) },
            { additionalProperties: false }
        )
    ),
    /** The stock round in which each company last reissued its redeemed shares (§5.11). */
    reissues: Type.Optional(Type.Record(Id, StockRoundNumber)),
    /** Reissued shares' proceeds this stock round, unspendable until it ends (§5.11). */
    lockedProceeds: Type.Optional(
        Type.Object(
            {
                stockRound: StockRoundNumber,
                amounts: Type.Record(Id, Type.Integer({ minimum: 1 }))
            },
            { additionalProperties: false }
        )
    ),
    /** Companies holding a West Virginia Coal Fields token. */
    coalRights: Type.Array(Id, { uniqueItems: true }),
    /** The latest WVCF token bought, which uses one of that turn's yellow lays. */
    coalPurchase: Type.Optional(
        Type.Object({ companyId: Id, turn: OperatingTurn }, { additionalProperties: false })
    ),
    revenueTokens: Type.Array(RevenueToken),
    /** The stock round in which each company's president's certificate was bought. */
    companyStarts: Type.Record(Id, Type.Integer({ minimum: 1 })),
    /** Set once a company has run to Miami before phase 5. */
    miamiRun: Type.Optional(Type.Literal(true)),
    /** The company whose share the London Investment Company bought. */
    londonCompanyId: Type.Optional(Id)
}
export type EighteenThirtyTwoTitleState = Type.Static<
    Type.TObject<typeof EighteenThirtyTwoTitleFields>
>

/** Whether a company is in this game; prepared positions leave some privates out. */
export function inGame(state: { companies: readonly { id: string }[] }, companyId: string) {
    return state.companies.some((company) => company.id === companyId)
}

export function sameOperatingTurn(
    turn: OperatingTurn,
    set: { number: number; roundNumber: number } | undefined
): boolean {
    return !!set && turn.set === set.number && turn.round === set.roundNumber
}
