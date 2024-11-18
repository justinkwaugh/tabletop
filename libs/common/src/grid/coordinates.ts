import { Type, type Static } from '@sinclair/typebox'
import { szudzikPairSigned } from '../util/pairing.js'
import { isAxial, isOffset } from 'honeycomb-grid'

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
export type OffsetTupleCoordinates = Static<typeof OffsetTupleCoordinates>
export const OffsetTupleCoordinates = Type.Tuple([Type.Number(), Type.Number()])

export function isOffsetTuple(value: unknown): value is OffsetTupleCoordinates {
    return (
        Array.isArray(value) &&
        value.length === 2 &&
        typeof value[0] === 'number' &&
        typeof value[1] === 'number'
    )
}

export type SquareCoordinates = Static<typeof SquareCoordinates>
export const SquareCoordinates = Type.Union([OffsetCoordinates, OffsetTupleCoordinates])

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

export type HexTupleCoordinates = Static<typeof HexTupleCoordinates>
export const HexTupleCoordinates = Type.Tuple([
    Type.Number(),
    Type.Number(),
    Type.Optional(Type.Number())
])

export function isHexTuple(value: unknown): value is HexTupleCoordinates {
    return (
        Array.isArray(value) &&
        value.length === 3 &&
        typeof value[0] === 'number' &&
        typeof value[1] === 'number'
    )
}

export type HexCoordinates = Static<typeof HexCoordinates>
export const HexCoordinates = Type.Union([AxialCoordinates, OffsetCoordinates, HexTupleCoordinates])

export type Coordinates = Static<typeof Coordinates>
export const Coordinates = Type.Union([
    OffsetCoordinates,
    OffsetTupleCoordinates,
    AxialCoordinates,
    HexTupleCoordinates
])

export function coordinatesToNumber(coords: OffsetCoordinates): number
export function coordinatesToNumber(coords: AxialCoordinates): number
export function coordinatesToNumber(coords: OffsetTupleCoordinates): number
export function coordinatesToNumber(coords: HexTupleCoordinates): number
export function coordinatesToNumber(coords: Coordinates): number
export function coordinatesToNumber(coords: unknown): number {
    if (isAxial(coords)) {
        return szudzikPairSigned(coords.q, coords.r)
    }
    if (isOffset(coords)) {
        return szudzikPairSigned(coords.col, coords.row)
    }
    if (isOffsetTuple(coords)) {
        return szudzikPairSigned(coords[0], coords[1])
    }
    if (isHexTuple(coords)) {
        return szudzikPairSigned(coords[0], coords[1])
    }
    throw Error('Invalid coordinates')
}

export function axialCoordinatesToNumber(axial: AxialCoordinates): number {
    return szudzikPairSigned(axial.q, axial.r)
}

export function sameCoordinates(a?: OffsetCoordinates, b?: OffsetCoordinates): boolean
export function sameCoordinates(a?: AxialCoordinates, b?: AxialCoordinates): boolean
export function sameCoordinates(a?: unknown, b?: unknown): boolean {
    if (a === undefined || b === undefined) {
        return false
    }

    if (isAxial(a) && isAxial(b)) {
        return a.q === b.q && a.r === b.r
    }
    if (isOffset(a) && isOffset(b)) {
        return a.col === b.col && a.row === b.row
    }

    return false
}
