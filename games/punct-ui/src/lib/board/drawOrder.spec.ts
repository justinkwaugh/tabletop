import { describe, expect, it } from 'vitest'
import { drawOrder, type Stander } from './drawOrder.js'
import { VIEW, viewOf } from './geometry.js'

const keys = (standers: Stander[]) => standers.map((stander) => stander.key)

describe('drawOrder', () => {
    // Two pieces in one column, a space apart: straight down the screen, the lower one is nearer;
    // rotated, the column runs across and neither stands in front.
    const far: Stander = { key: 'far', cells: [{ q: 0, r: -1 }], level: 0 }
    const near: Stander = { key: 'near', cells: [{ q: 0, r: 1 }], level: 0 }
    // In the next column, a row nearer on the rotated board.
    const beside: Stander = { key: 'beside', cells: [{ q: 1, r: 0 }], level: 0 }

    it('draws the farther of two pieces in a column first', () => {
        expect(keys(drawOrder([near, far], VIEW))).toEqual(['far', 'near'])
        expect(keys(drawOrder([far, near], viewOf(false, true)))).toEqual(['near', 'far'])
    })

    it('draws a piece in the next column after one a quarter turn round', () => {
        expect(keys(drawOrder([beside, far], viewOf(true, false)))).toEqual(['far', 'beside'])
        expect(keys(drawOrder([far, beside], viewOf(true, true)))).toEqual(['beside', 'far'])
    })

    it('stands a piece over the one it rests on whichever way round', () => {
        const under: Stander = { key: 'under', cells: [{ q: 0, r: 0 }], level: 0 }
        const over: Stander = {
            key: 'over',
            cells: [
                { q: 0, r: 0 },
                { q: 1, r: -1 }
            ],
            level: 1
        }
        for (const view of [VIEW, viewOf(true, false), viewOf(true, true)]) {
            expect(keys(drawOrder([over, under], view))).toEqual(['under', 'over'])
        }
    })
})
