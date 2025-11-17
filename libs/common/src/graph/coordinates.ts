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

/**
 * @deprecated It is recommended to use OffsetCoordinates instead
 */
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

// Convert between the two offset coordinate representations
export function offsetToOffsetTuple(coords: OffsetCoordinates): OffsetTupleCoordinates {
    return [coords.col, coords.row]
}
export function offsetTupleToOffset(coords: OffsetTupleCoordinates): OffsetCoordinates {
    return { col: coords[0], row: coords[1] }
}

// Hex Grid specific coordinates
export type AxialCoordinates = Static<typeof AxialCoordinates>
export const AxialCoordinates = Type.Object({
    q: Type.Number(),
    r: Type.Number()
})

// Should this even be offered?
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
    if (isOffsetTuple(coords) || isHexTuple(coords)) {
        return szudzikPairSigned(coords[0], coords[1])
    }

    throw Error('Invalid coordinates')
}

export function sameCoordinates(a?: OffsetCoordinates, b?: OffsetCoordinates): boolean
export function sameCoordinates(a?: AxialCoordinates, b?: AxialCoordinates): boolean
export function sameCoordinates(a?: OffsetTupleCoordinates, b?: OffsetTupleCoordinates): boolean
export function sameCoordinates(a?: HexTupleCoordinates, b?: HexTupleCoordinates): boolean
export function sameCoordinates(a?: Coordinates, b?: Coordinates): boolean
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
    if (isOffsetTuple(a) && isOffsetTuple(b)) {
        return a[0] === b[0] && a[1] === b[1]
    }
    if (isHexTuple(a) && isHexTuple(b)) {
        return a[0] === b[0] && a[1] === b[1] && a[2] === b[2]
    }

    return false
}
