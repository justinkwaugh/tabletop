import * as Type from 'typebox'
import { DestinationRunFields, PriceProtectionFields, ShareRedemptionFields } from '@tabletop/18xx'

const Id = Type.String({ minLength: 1 })

export const RevenueTokenKind = Type.Union([
    Type.Literal('cattle'),
    Type.Literal('open-port'),
    Type.Literal('closed-port')
])
export type RevenueTokenKind = Type.Static<typeof RevenueTokenKind>

export const RevenueToken = Type.Object(
    {
        kind: RevenueTokenKind,
        companyId: Id,
        locationId: Id,
        placedInRound: Type.Tuple([Type.Integer({ minimum: 1 }), Type.Integer({ minimum: 1 })])
    },
    { additionalProperties: false }
)
export type RevenueToken = Type.Static<typeof RevenueToken>

export const TitleFields1870 = {
    ...PriceProtectionFields,
    ...ShareRedemptionFields,
    ...DestinationRunFields,
    /** The variants chosen before the game began (pp. 24-25). */
    variants: Type.Object(
        {
            finish400: Type.Optional(Type.Literal(true)),
            diesels: Type.Optional(Type.Literal(true)),
            stationWars: Type.Optional(Type.Literal(true))
        },
        { additionalProperties: false }
    ),
    revenueTokens: Type.Array(RevenueToken),
    bridgeLayLocationId: Type.Optional(Type.String())
}
export type TitleState1870 = Type.Static<Type.TObject<typeof TitleFields1870>>
