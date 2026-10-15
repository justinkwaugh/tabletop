import * as Type from 'typebox'
import { CoralColor } from './colors.js'

// The five larva spaces in clockwise order, as the arrows on the open-sea board run.
export const OpenSeaOrder: readonly CoralColor[] = [
    CoralColor.White,
    CoralColor.Yellow,
    CoralColor.Orange,
    CoralColor.Pink,
    CoralColor.Grey
]

// Starting from the space whose colour was drawn, then clockwise (rulebook p. 3).
export const StartingOpenSeaPolyps: readonly number[] = [3, 3, 3, 2, 1]

export type OpenSeaSpace = Type.Static<typeof OpenSeaSpace>
export const OpenSeaSpace = Type.Object({
    larvaColor: Type.Enum(CoralColor),
    hasLarvaCube: Type.Boolean(),
    polyps: Type.Array(Type.Enum(CoralColor))
})

// Every space short of three polyps gains one when the open sea is refilled (rulebook p. 5).
export const OpenSeaPolypLimit = 3

export type OpenSeaAddition = Type.Static<typeof OpenSeaAddition>
export const OpenSeaAddition = Type.Object({
    larvaColor: Type.Enum(CoralColor),
    polyp: Type.Enum(CoralColor)
})

export type OpenSeaRefill = Type.Static<typeof OpenSeaRefill>
export const OpenSeaRefill = Type.Object({
    larvaColor: Type.Enum(CoralColor),
    additions: Type.Array(OpenSeaAddition),
    bonusPolypsReturned: Type.Boolean(),
    shortage: Type.Boolean()
})

export function spacesClockwiseFrom(first: CoralColor): CoralColor[] {
    const start = OpenSeaOrder.indexOf(first)
    return OpenSeaOrder.map((_, offset) => OpenSeaOrder[(start + offset) % OpenSeaOrder.length])
}
