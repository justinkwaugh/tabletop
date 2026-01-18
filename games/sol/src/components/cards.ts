import * as Type from 'typebox'
export enum Suit {
    Refraction = 'Refraction',
    Condensation = 'Condensation',
    Subduction = 'Subduction',
    Oscillation = 'Oscillation',
    Expansion = 'Expansion',
    Reverberation = 'Reverberation',
    Flare = 'Flare'
}

export type Card = Type.Static<typeof Card>
export const Card = Type.Object({
    id: Type.String(),
    suit: Type.Enum(Suit)
})
