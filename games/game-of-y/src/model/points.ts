import * as Type from 'typebox'
import { assertExists } from '@tabletop/common'
import { POINT_LINKS } from './pointLinks.js'

export enum Side {
    Bottom = 'Bottom',
    Left = 'Left',
    Right = 'Right'
}

export const ROW_LENGTHS: readonly number[] = [9, 10, 11, 12, 13, 12, 11, 10, 5]
const LETTERS = 'ABCDEFGHIJKLM'

export const POINTS: readonly string[] = ROW_LENGTHS.flatMap((length, row) =>
    Array.from(LETTERS.slice(0, length), (letter) => `${letter}${row + 1}`)
)

export const Point = Type.Unsafe<string>(Type.Union(POINTS.map((point) => Type.Literal(point))))

const NEIGHBORS = new Map(POINTS.map((point) => [point, POINT_LINKS[point]]))

export const TOP_CORNER = 'A9'

export function isPoint(point: string): boolean {
    return NEIGHBORS.has(point)
}

export function neighborsOf(point: string): readonly string[] {
    const neighbors = NEIGHBORS.get(point)
    assertExists(neighbors, `No point ${point}`)
    return neighbors
}

export function rowOf(point: string): number {
    return Number(point.slice(1))
}

function letterIndex(point: string): number {
    return LETTERS.indexOf(point[0])
}

// Each row but the last runs from the left side to the right; the top corner ends both sides.
export function sidesOf(point: string): Side[] {
    const row = rowOf(point)
    const index = letterIndex(point)
    const sides: Side[] = []
    if (row === 1) sides.push(Side.Bottom)
    if (index === 0) sides.push(Side.Left)
    if (point === TOP_CORNER || (row < ROW_LENGTHS.length && index === ROW_LENGTHS[row - 1] - 1)) {
        sides.push(Side.Right)
    }
    return sides
}
