import { addAxial, scaleAxial, type AxialCoordinates } from '@tabletop/common'
import { direction } from './geometry.js'

// Rule B1: each player's set of 18, every piece three dots, one of them its PÜNCT.
export enum PieceKind {
    Triangle = 'triangle',
    StraightEnd = 'straightEnd',
    StraightCentre = 'straightCentre',
    AngleCorner = 'angleCorner',
    AngleLeft = 'angleLeft',
    AngleRight = 'angleRight'
}

export const PIECE_KINDS: readonly PieceKind[] = [
    PieceKind.Triangle,
    PieceKind.StraightEnd,
    PieceKind.StraightCentre,
    PieceKind.AngleCorner,
    PieceKind.AngleLeft,
    PieceKind.AngleRight
]

export const SET_COUNTS: Record<PieceKind, number> = {
    [PieceKind.Triangle]: 6,
    [PieceKind.StraightEnd]: 4,
    [PieceKind.StraightCentre]: 2,
    [PieceKind.AngleCorner]: 2,
    [PieceKind.AngleLeft]: 2,
    [PieceKind.AngleRight]: 2
}

export const SET_SIZE = PIECE_KINDS.reduce((total, kind) => total + SET_COUNTS[kind], 0)

// Rule 4/1: straight and angular pieces can bridge a gap between their two end dots. Dots are
// listed PÜNCT first, so a span names its dots by index.
export type Span = { ends: readonly [number, number]; middle: number }

type Shape = {
    offsets: (rotation: number) => readonly AxialCoordinates[]
    span?: Span
    rotations: readonly number[]
}

const ALL_ROTATIONS = [0, 1, 2, 3, 4, 5]
const ORIGIN: AxialCoordinates = { q: 0, r: 0 }

// Rotation steps the minor dots clockwise round the PÜNCT. An angular piece with its PÜNCT at an
// end turns left or right at its corner, walking from the PÜNCT; the two are mirror images.
const SHAPES: Record<PieceKind, Shape> = {
    [PieceKind.Triangle]: {
        offsets: (rotation) => [ORIGIN, direction(rotation), direction(rotation + 1)],
        rotations: ALL_ROTATIONS
    },
    [PieceKind.StraightEnd]: {
        offsets: (rotation) => [ORIGIN, direction(rotation), scaleAxial(direction(rotation), 2)],
        span: { ends: [0, 2], middle: 1 },
        rotations: ALL_ROTATIONS
    },
    // Its minor dots look alike, so a half turn leaves it as it was.
    [PieceKind.StraightCentre]: {
        offsets: (rotation) => [ORIGIN, direction(rotation), direction(rotation + 3)],
        span: { ends: [1, 2], middle: 0 },
        rotations: [0, 1, 2]
    },
    [PieceKind.AngleCorner]: {
        offsets: (rotation) => [ORIGIN, direction(rotation), direction(rotation + 2)],
        span: { ends: [1, 2], middle: 0 },
        rotations: ALL_ROTATIONS
    },
    [PieceKind.AngleLeft]: {
        offsets: (rotation) => [
            ORIGIN,
            direction(rotation),
            addAxial(direction(rotation), direction(rotation - 1))
        ],
        span: { ends: [0, 2], middle: 1 },
        rotations: ALL_ROTATIONS
    },
    [PieceKind.AngleRight]: {
        offsets: (rotation) => [
            ORIGIN,
            direction(rotation),
            addAxial(direction(rotation), direction(rotation + 1))
        ],
        span: { ends: [0, 2], middle: 1 },
        rotations: ALL_ROTATIONS
    }
}

export function dotsOf(
    kind: PieceKind,
    punct: AxialCoordinates,
    rotation: number
): AxialCoordinates[] {
    return SHAPES[kind].offsets(rotation).map((offset) => addAxial(punct, offset))
}

export function spanOf(kind: PieceKind): Span | undefined {
    return SHAPES[kind].span
}

// The rotations that place a piece differently.
export function rotationsOf(kind: PieceKind): readonly number[] {
    return SHAPES[kind].rotations
}

// How many steps round before a piece covers the same spaces with its dots alike again. The
// straight piece with its PÜNCT in the middle does so half a turn round; it is still the same
// placement, but the piece lies the other way, as its flecks show, so a piece keeps whichever
// of the six ways it was put.
export function samePlacementPeriod(kind: PieceKind): number {
    return rotationsOf(kind).length
}

export function sameOrientation(kind: PieceKind, a: number, b: number): boolean {
    const period = samePlacementPeriod(kind)
    return (((a - b) % period) + period) % period === 0
}
