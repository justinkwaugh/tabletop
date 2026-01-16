import * as Type from 'typebox'
import { szudzikPairSigned } from '../util/pairing.js'

export type Point = Type.Static<typeof Point>
export const Point = Type.Object({
    x: Type.Number(),
    y: Type.Number()
})

export type PolarCoordinates = Type.Static<typeof PolarCoordinates>
export const PolarCoordinates = Type.Object({
    radius: Type.Number(),
    angle: Type.Number()
})

export type OffsetCoordinates = Type.Static<typeof OffsetCoordinates>
export const OffsetCoordinates = Type.Object({
    col: Type.Number(),
    row: Type.Number()
})

export type OffsetTupleCoordinates = Type.Static<typeof OffsetTupleCoordinates>
export const OffsetTupleCoordinates = Type.Tuple([Type.Number(), Type.Number()])

export type AxialCoordinates = Type.Static<typeof AxialCoordinates>
export const AxialCoordinates = Type.Object({
    q: Type.Number(),
    r: Type.Number()
})

export type HexTupleCoordinates = Type.Static<typeof HexTupleCoordinates>
export const HexTupleCoordinates = Type.Tuple([
    Type.Number(),
    Type.Number(),
    Type.Optional(Type.Number())
])

export type CubeCoordinates = Type.Static<typeof CubeCoordinates>
export const CubeCoordinates = Type.Object({
    q: Type.Number(),
    r: Type.Number(),
    s: Type.Number()
})

export type HexCoordinates = Type.Static<typeof HexCoordinates>
export const HexCoordinates = Type.Union([AxialCoordinates, OffsetCoordinates, HexTupleCoordinates])

export type RectilinearCoordinates = Type.Static<typeof RectilinearCoordinates>
export const RectilinearCoordinates = Type.Union([OffsetCoordinates, OffsetTupleCoordinates])

export type Coordinates = Type.Static<typeof Coordinates>
export const Coordinates = Type.Union([
    OffsetCoordinates,
    OffsetTupleCoordinates,
    AxialCoordinates,
    CubeCoordinates,
    HexTupleCoordinates
])

export function isOffset(value: unknown): value is OffsetCoordinates {
    return (
        typeof value === 'object' &&
        value !== null &&
        'col' in value &&
        'row' in value &&
        typeof (value as any).col === 'number' &&
        typeof (value as any).row === 'number'
    )
}

export function isOffsetTuple(value: unknown): value is OffsetTupleCoordinates {
    return (
        Array.isArray(value) &&
        value.length === 2 &&
        typeof value[0] === 'number' &&
        typeof value[1] === 'number'
    )
}

export function isAxial(value: unknown): value is AxialCoordinates {
    return (
        typeof value === 'object' &&
        value !== null &&
        'q' in value &&
        'r' in value &&
        typeof (value as any).q === 'number' &&
        typeof (value as any).r === 'number'
    )
}

export function isCube(value: unknown): value is CubeCoordinates {
    return (
        typeof value === 'object' &&
        value !== null &&
        'q' in value &&
        'r' in value &&
        's' in value &&
        typeof (value as any).q === 'number' &&
        typeof (value as any).r === 'number' &&
        typeof (value as any).s === 'number'
    )
}

export function isHexTuple(value: unknown): value is HexTupleCoordinates {
    return (
        Array.isArray(value) &&
        value.length === 3 &&
        typeof value[0] === 'number' &&
        typeof value[1] === 'number' &&
        (value[2] === undefined || typeof value[2] === 'number')
    )
}

export function offsetToOffsetTuple(coords: OffsetCoordinates): OffsetTupleCoordinates {
    return [coords.col, coords.row]
}
export function offsetTupleToOffset(coords: OffsetTupleCoordinates): OffsetCoordinates {
    return { col: coords[0], row: coords[1] }
}

export function axialToCube(coords: AxialCoordinates): CubeCoordinates {
    return { q: coords.q, r: coords.r, s: -coords.q - coords.r }
}

export function cubeToAxial(coords: CubeCoordinates): AxialCoordinates {
    return { q: coords.q, r: coords.r }
}

export function samePoint(a: Point | undefined, b: Point | undefined): boolean {
    if (a === undefined || b === undefined) {
        return false
    }
    return a.x === b.x && a.y === b.y
}

export function coordinatesToNumber(coords: OffsetCoordinates): number
export function coordinatesToNumber(coords: AxialCoordinates): number
export function coordinatesToNumber(coords: CubeCoordinates): number
export function coordinatesToNumber(coords: OffsetTupleCoordinates): number
export function coordinatesToNumber(coords: HexTupleCoordinates): number
export function coordinatesToNumber(coords: Coordinates): number
export function coordinatesToNumber(coords: unknown): number {
    if (isAxial(coords) || isCube(coords)) {
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
export function sameCoordinates(a?: CubeCoordinates, b?: CubeCoordinates): boolean
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
    if (isCube(a) && isCube(b)) {
        return a.q === b.q && a.r === b.r && a.s === b.s
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
