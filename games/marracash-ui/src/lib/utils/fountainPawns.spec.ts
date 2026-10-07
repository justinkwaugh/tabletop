import { describe, expect, it } from 'vitest'
import { fountainPawnPositions, FountainRowStagger } from './fountainPawns.js'

const center = { x: 100, y: 100 }

function rowsOf(count: number): number[][] {
    const rows = new Map<number, number[]>()
    for (const { x, y } of fountainPawnPositions(count, center)) {
        rows.set(y, [...(rows.get(y) ?? []), x])
    }
    return [...rows.entries()].sort(([a], [b]) => a - b).map(([, xs]) => xs)
}

describe('fountain pawn layout', () => {
    it.each([4, 6, 9])('staggers full rows left, right, left for %i pawns', (count) => {
        const rows = rowsOf(count)
        for (let row = 1; row < rows.length; row++) {
            expect(rows[row][0] - rows[row - 1][0]).toBeCloseTo(
                row % 2 === 1 ? FountainRowStagger : -FountainRowStagger
            )
        }
    })

    it.each([2, 3, 5, 7, 8])('leaves %i pawns unstaggered', (count) => {
        const rows = rowsOf(count)
        const centers = rows.map((xs) => (Math.min(...xs) + Math.max(...xs)) / 2)
        for (const rowCenter of centers) expect(rowCenter).toBeCloseTo(center.x)
    })

    it('staggers full rows by the same offset a short row has', () => {
        const [fullRow, shortRow] = rowsOf(5)
        expect(shortRow[0] - fullRow[0]).toBeCloseTo(FountainRowStagger)
    })
})
