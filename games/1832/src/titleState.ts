import * as Type from 'typebox'
import { OwnershipLimitExemption } from '@tabletop/18xx'

const Id = Type.String({ minLength: 1 })

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

export const EighteenThirtyTwoTitleFields = {
    priceProtection: Type.Optional(PriceProtection),
    /** Presidents keeping more than 60% after protecting, until they next sell (§5.9.8). */
    ownershipLimitExemptions: Type.Optional(Type.Array(OwnershipLimitExemption)),
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
