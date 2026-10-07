import { assert } from '@tabletop/common'
import * as Type from 'typebox'

const Id = Type.String({ minLength: 1 })

export const RevenueTokenKind = Type.Union([
    Type.Literal('port'),
    Type.Literal('cotton'),
    Type.Literal('key-west')
])
export type RevenueTokenKind = Type.Static<typeof RevenueTokenKind>

/** A Port, Cotton or Key West token on the map, and the operating turn it was placed in. */
export const RevenueToken = Type.Object(
    {
        kind: RevenueTokenKind,
        companyId: Id,
        locationId: Id,
        nodeId: Id,
        placed: Type.Object(
            { set: Type.Integer({ minimum: 1 }), round: Type.Integer({ minimum: 1 }) },
            { additionalProperties: false }
        )
    },
    { additionalProperties: false }
)
export type RevenueToken = Type.Static<typeof RevenueToken>

export const EighteenThirtyTwoTitleFields = {
    /** Companies holding a West Virginia Coal Fields token. */
    coalRights: Type.Array(Id, { uniqueItems: true }),
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

export function hasTitleState<State extends object>(
    state: State
): state is State & EighteenThirtyTwoTitleState {
    return 'coalRights' in state && 'revenueTokens' in state && 'companyStarts' in state
}

/** A family hook's state, which always carries this title's own fields. */
export function requireTitleState<State extends object>(
    state: State
): State & EighteenThirtyTwoTitleState {
    assert(hasTitleState(state), 'Family hooks receive the 1832 state')
    return state
}

/** Whether a company is in this game; prepared positions leave some privates out. */
export function inGame(state: { companies: readonly { id: string }[] }, companyId: string) {
    return state.companies.some((company) => company.id === companyId)
}
