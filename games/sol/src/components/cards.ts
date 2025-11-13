import { type Static, Type } from '@sinclair/typebox'

export enum Suit {
    Refraction = 'Refraction',
    Condensation = 'Condensation',
    Subduction = 'Subduction',
    Oscillation = 'Oscillation',
    Expansion = 'Expansion',
    Reverberation = 'Reverberation',
    Flare = 'Flare'
}

export type Card = Static<typeof Card>
export const Card = Type.Object({
    suit: Type.Enum(Suit)
})
