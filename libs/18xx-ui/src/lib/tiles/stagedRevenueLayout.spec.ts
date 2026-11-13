import { describe, expect, it } from 'vitest'
import { stagedRevenueLayout } from './stagedRevenueLayout.js'

const revenue = {
    kind: 'staged' as const,
    values: [
        { stage: 'low', amount: 20 },
        { stage: 'middle', amount: 30 },
        { stage: 'high', amount: 40 }
    ]
}
const vertices = [0, 1, 2, 3, 4, 5].map((index) => ({
    x: 50 * Math.cos((index * Math.PI) / 3),
    y: 50 * Math.sin((index * Math.PI) / 3)
}))
const captions = { low: '4', middle: '8', high: '12' }

describe('staged revenue captions', () => {
    it('stacks captioned values in a column, each caption beside its value', () => {
        const cells = stagedRevenueLayout(revenue, { x: -25, y: 0 }, vertices, [], [], {
            captions,
            fixed: true
        })
        expect(new Set(cells.map((cell) => cell.x)).size).toBe(1)
        expect(cells.every((cell) => !cell.captionAbove)).toBe(true)
    })

    it('lines values up in a row with their captions above where asked', () => {
        const anchor = { x: 0, y: 30 }
        const cells = stagedRevenueLayout(revenue, anchor, vertices, [], [], {
            captions,
            captionAbove: true,
            fixed: true
        })
        expect(new Set(cells.map((cell) => cell.y)).size).toBe(1)
        expect(cells.map((cell) => cell.caption)).toEqual(['4', '8', '12'])
        expect(cells.every((cell) => cell.captionAbove)).toBe(true)
        // The row and its captions centre on the anchor.
        expect(cells[1].x).toBe(anchor.x)
        expect(cells[0].y).toBeGreaterThan(anchor.y)
    })
})
