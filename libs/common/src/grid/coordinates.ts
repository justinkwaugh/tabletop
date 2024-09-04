import { Type, type Static } from '@sinclair/typebox'
import { szudzikPairSigned } from '../util/pairing.js'

export type Point = Static<typeof Point>
export const Point = Type.Object({
    x: Type.Number(),
    y: Type.Number()
})

// Useful for both square and hex grids
export type OffsetCoordinates = Static<typeof OffsetCoordinates>
export const OffsetCoordinates = Type.Object({
    col: Type.Number(),
    row: Type.Number()
})

// SQUARE GRID
export type SquareTupleCoordinates = Static<typeof SquareTupleCoordinates>
export const SquareTupleCoordinates = Type.Tuple([Type.Number(), Type.Number()])

export type SquareCoordinates = Static<typeof SquareCoordinates>
export const SquareCoordinates = Type.Union([OffsetCoordinates, SquareTupleCoordinates])

// HEX GRID
export type AxialCoordinates = Static<typeof AxialCoordinates>
export const AxialCoordinates = Type.Object({
    q: Type.Number(),
    r: Type.Number()
})

export type CubeCoordinates = Static<typeof CubeCoordinates>
export const CubeCoordinates = Type.Object({
    q: Type.Number(),
    r: Type.Number(),
    s: Type.Number()
})

export type PartialCubeCoordinates = Static<typeof PartialCubeCoordinates>
export const PartialCubeCoordinates = Type.Union([
    Type.Object({ q: Type.Optional(Type.Number()), r: Type.Number(), s: Type.Number() }),
    Type.Object({ q: Type.Number(), r: Type.Optional(Type.Number()), s: Type.Number() }),
    Type.Object({ q: Type.Number(), r: Type.Number(), s: Type.Optional(Type.Number()) })
])

export type HexTupleCoordinates = Static<typeof HexTupleCoordinates>
export const HexTupleCoordinates = Type.Tuple([
    Type.Number(),
    Type.Number(),
    Type.Optional(Type.Number())
])

export type HexCoordinates = Static<typeof HexCoordinates>
export const HexCoordinates = Type.Union([
    AxialCoordinates,
    PartialCubeCoordinates,
    OffsetCoordinates,
    HexTupleCoordinates
])

export function axialCoordinatesToNumber(axial: AxialCoordinates): number {
    return szudzikPairSigned(axial.q, axial.r)
}

export function sameCoordinates(a?: AxialCoordinates, b?: AxialCoordinates): boolean {
    return a !== undefined && b !== undefined && a.q === b.q && a.r === b.r
}
