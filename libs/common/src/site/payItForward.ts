import * as Type from 'typebox'

export enum Charity {
    GamersOutreach = 'gamers-outreach',
    SpecialEffect = 'specialeffect'
}

export const CurrencyCode = Type.String({ pattern: '^[A-Z]{3}$' })
export type CurrencyCode = Type.Static<typeof CurrencyCode>

export const CharityRaised = Type.Object(
    {
        charity: Type.Enum(Charity),
        amount: Type.Number({ minimum: 0 }),
        currency: CurrencyCode,
        campaignOpen: Type.Boolean()
    },
    { additionalProperties: false }
)
export type CharityRaised = Type.Static<typeof CharityRaised>

export const CharityTally = Type.Object(
    {
        totalUsd: Type.Number({ minimum: 0 }),
        charities: Type.Array(CharityRaised)
    },
    { additionalProperties: false }
)
export type CharityTally = Type.Static<typeof CharityTally>
