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
    polyps: Type.Array(Type.Enum(CoralColor))
})

export function spacesClockwiseFrom(first: CoralColor): CoralColor[] {
    const start = OpenSeaOrder.indexOf(first)
    return OpenSeaOrder.map((_, offset) => OpenSeaOrder[(start + offset) % OpenSeaOrder.length])
}
