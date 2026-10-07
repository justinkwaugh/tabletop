import * as Type from 'typebox'

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

export const EighteenThirtyTwoTitleFields = {
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
