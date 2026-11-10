import { describe, expect, it } from 'vitest'
import { ExposedShare, handMargins } from './handSpacing.js'

// Where each card's left edge falls.
function lefts(margins: number[], cardWidth: number): number[] {
    let left = 0
    return margins.map((margin, index) => {
        left += index === 0 ? 0 : cardWidth + margin
        return left
    })
}

describe('handMargins', () => {
    it('lays cards side by side when they fit', () => {
        expect(handMargins(4, 100, 1000, 1)).toEqual([0, 0, 0, 0])
    })

    it('overlaps cards evenly to fill the room', () => {
        const margins = handMargins(12, 124, 724)
        const at = lefts(margins, 124)
        expect(at.at(-1)! + 124).toBeCloseTo(724)
        expect(new Set(margins.slice(1).map((m) => m.toFixed(6))).size).toBe(1)
    })

    it('shows the exposed card past its numeral and keeps the row width', () => {
        const margins = handMargins(12, 124, 724, 4)
        const at = lefts(margins, 124)
        expect(at[5]! - at[4]!).toBeCloseTo(124 * ExposedShare)
        expect(at.at(-1)! + 124).toBeCloseTo(724)
    })

    it('keeps every edge of the exposed card where its strip already was or wider', () => {
        const even = lefts(handMargins(12, 124, 724), 124)
        for (let exposed = 0; exposed < 11; exposed++) {
            const at = lefts(handMargins(12, 124, 724, exposed), 124)
            expect(at[exposed]!).toBeLessThanOrEqual(even[exposed]! + 1e-9)
            expect(at[exposed + 1]!).toBeGreaterThanOrEqual(even[exposed + 1]! - 1e-9)
        }
    })

    it('leaves the last card and an already open hand alone', () => {
        expect(handMargins(12, 124, 724, 11)).toEqual(handMargins(12, 124, 724))
        expect(handMargins(12, 104, 1200, 3)).toEqual(handMargins(12, 104, 1200))
    })

    it('handles tiny hands', () => {
        expect(handMargins(0, 100, 100)).toEqual([])
        expect(handMargins(1, 100, 50, 0)).toEqual([0])
    })
})
