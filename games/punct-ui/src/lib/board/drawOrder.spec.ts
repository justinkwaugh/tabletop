import { describe, expect, it } from 'vitest'
import { spaceAt } from '@tabletop/punct'
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

    // From the Layers scenario: piece 0 rests on 2 and under 6; 11 lies beside them across the
    // column, behind 2's near end and in front of 0, so farther and nearer alone form a cycle.
    it('never draws a piece before one it rests on, even in a cycle of farther and nearer', () => {
        const piece = (key: string, names: string[], level: number): Stander => ({
            key,
            cells: names.map(spaceAt),
            level
        })
        const standers = [
            piece('0', ['G12', 'H12', 'F11'], 1),
            piece('2', ['H11', 'H12', 'G12'], 0),
            piece('6', ['F10', 'F11', 'G11'], 2),
            piece('11', ['I12', 'J13', 'K13'], 0)
        ]
        for (const [rotated, turned] of [
            [false, false],
            [false, true],
            [true, false],
            [true, true]
        ]) {
            const order = keys(drawOrder(standers, viewOf(rotated, turned)))
            expect(order.indexOf('2')).toBeLessThan(order.indexOf('0'))
            expect(order.indexOf('0')).toBeLessThan(order.indexOf('6'))
        }
    })
})
