import { describe, expect, it } from 'vitest'
import { FountainPawnSpacing, fountainPawnPositions, MaxPawnsShown } from './fountainPawns.js'

const center = { x: 100, y: 100 }

function rowsOf(count: number): number[][] {
    const rows = new Map<number, number[]>()
    for (const { x, y } of fountainPawnPositions(count, center)) {
        rows.set(y, [...(rows.get(y) ?? []), x])
    }
    return [...rows.entries()].sort(([a], [b]) => a - b).map(([, xs]) => xs)
}

const counts = Array.from({ length: MaxPawnsShown }, (_, index) => index + 1)

describe('fountain pawn layout', () => {
    it.each(counts)('never stands one of %i pawns directly behind another', (count) => {
        const rows = rowsOf(count)
        for (let row = 1; row < rows.length; row++) {
            for (const front of rows[row]) {
                for (const back of rows[row - 1]) {
                    expect(Math.abs(front - back)).toBeGreaterThanOrEqual(
                        FountainPawnSpacing.x / 2 - 0.001
                    )
                }
            }
        }
    })

    it.each(counts)('centres a cluster of %i pawns on the fountain', (count) => {
        const xs = rowsOf(count).flat()
        expect((Math.min(...xs) + Math.max(...xs)) / 2).toBeCloseTo(center.x)
    })

    it.each([4, 6, 9])('staggers full rows left, right, left for %i pawns', (count) => {
        const rows = rowsOf(count)
        for (let row = 1; row < rows.length; row++) {
            expect(rows[row][0] - rows[row - 1][0]).toBeCloseTo(
                ((row % 2 === 1 ? 1 : -1) * FountainPawnSpacing.x) / 2
            )
        }
    })

    it.each([2, 3, 5])('keeps the plain layout for %i pawns', (count) => {
        for (const xs of rowsOf(count)) {
            expect((Math.min(...xs) + Math.max(...xs)) / 2).toBeCloseTo(center.x)
        }
    })
})
