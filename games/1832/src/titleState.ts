import * as Type from 'typebox'
import { PriceProtectionFields, ShareRedemptionFields } from '@tabletop/18xx'

const Id = Type.String({ minLength: 1 })

export const MergingState = 'Merging'

export const RevenueTokenKind = Type.Union([
    Type.Literal('port'),
    Type.Literal('cotton'),
    Type.Literal('key-west')
])
export type RevenueTokenKind = Type.Static<typeof RevenueTokenKind>

/** A Port, Cotton or Key West token on the map. */
export const RevenueToken = Type.Object(
    { kind: RevenueTokenKind, companyId: Id, locationId: Id, nodeId: Id },
    { additionalProperties: false }
)
export type RevenueToken = Type.Static<typeof RevenueToken>

export const MergerKind = Type.Union([Type.Literal('system'), Type.Literal('takeover')])
export type MergerKind = Type.Static<typeof MergerKind>

/**
 * A merger a player proposes between a company they preside and a partner. The proposer is the
 * initiator unless they yield to the partner's president, whose company then buys in a takeover.
 */
export const MergerProposal = Type.Object(
    {
        proposerPlayerId: Id,
        companyId: Id,
        partnerId: Id,
        kind: MergerKind,
        yielded: Type.Boolean()
    },
    { additionalProperties: false }
)
export type MergerProposal = Type.Static<typeof MergerProposal>

/** A takeover whose buyer's president is raising the price by selling shares (§11.7). */
export const TakeoverFunding = Type.Object(
    { buyerId: Id, targetId: Id, playerId: Id },
    { additionalProperties: false }
)
export type TakeoverFunding = Type.Static<typeof TakeoverFunding>

/**
 * A merger phase: players in priority order propose mergers until each has passed (§11.1). The
 * proposer is the player whose turn is under way.
 */
export const MergerPhase = Type.Object(
    {
        final: Type.Boolean(),
        proposal: Type.Optional(MergerProposal),
        funding: Type.Optional(TakeoverFunding),
        /** A buyer left over its train limit, whose president discards trains (§11.7.1). */
        discardCompanyId: Type.Optional(Id),
        /** Proposals refused this phase, which may not be made again in it. */
        refused: Type.Array(
            Type.Object(
                { companyId: Id, partnerId: Id, kind: MergerKind, yielded: Type.Boolean() },
                { additionalProperties: false }
            )
        )
    },
    { additionalProperties: false }
)
export type MergerPhase = Type.Static<typeof MergerPhase>

export const EighteenThirtyTwoTitleFields = {
    ...PriceProtectionFields,
    ...ShareRedemptionFields,
    /** The variants chosen before the game began (§17). */
    variants: Type.Object(
        {
            finish400: Type.Optional(Type.Literal(true)),
            diesels: Type.Optional(Type.Literal(true)),
            noMergers: Type.Optional(Type.Literal(true))
        },
        { additionalProperties: false }
    ),
    mergerPhase: Type.Optional(MergerPhase),
    /** Stations a survivor holds in place of a merged company's home (§7.3.3). */
    inheritedHomeStationIds: Type.Optional(Type.Array(Id)),
    /**
     * Stations returned to their charter from a city holding two of the company's, until they
     * are placed again (§7.3.3).
     */
    returnedStationIds: Type.Optional(Type.Array(Id, { minItems: 1, uniqueItems: true })),
    /** Companies that have bought another in a takeover, which may not take part in another. */
    takeoverBuyerIds: Type.Array(Id, { uniqueItems: true }),
    /** Set once this stock round's merger phase has been held, until the operating set begins. */
    mergerPhaseHeld: Type.Optional(Type.Literal(true)),
    /** Set once the last merger phase, after the first 6-train, has been held (§11.5). */
    mergersEnded: Type.Optional(Type.Literal(true)),
    /** Each System formed, with its two component companies (§11.6). */
    systems: Type.Record(Id, Type.Array(Id, { minItems: 2, maxItems: 2 })),
    /** Companies holding a West Virginia Coal Fields token. */
    coalRights: Type.Array(Id, { uniqueItems: true }),
    /** Set when the operating company buys a WVCF token, which uses one of its yellow lays. */
    coalTokenBought: Type.Optional(Type.Literal(true)),
    /** Port and Cotton tokens until phase 6, and the Key West token until phase 8. */
    revenueTokens: Type.Array(RevenueToken),
    /** Set when the Key West token is placed, as that turn's token placement (§7.5). */
    keyWestPlaced: Type.Optional(Type.Literal(true)),
    /** The company holding the FEC's Key West token right, once the FEC has merged away. */
    keyWestCompanyId: Type.Optional(Id),
    /** The stock round in which each company's president's certificate was bought. */
    companyStarts: Type.Record(Id, Type.Integer({ minimum: 1 })),
    /** Set once a company has run to Miami before phase 5. */
    miamiRun: Type.Optional(Type.Literal(true)),
    /** The company whose share the London Investment Company bought, until phase 5. */
    londonCompanyId: Type.Optional(Id)
}
export type EighteenThirtyTwoTitleState = Type.Static<
    Type.TObject<typeof EighteenThirtyTwoTitleFields>
>

/** Whether a company is in this game; prepared positions leave some privates out. */
export function inGame(state: { companies: readonly { id: string }[] }, companyId: string) {
    return state.companies.some((company) => company.id === companyId)
}
