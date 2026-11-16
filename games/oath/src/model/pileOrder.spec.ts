import { describe, expect, it } from 'vitest'
import {
    bottomFirst,
    bottomIndexFromTop,
    drawFromBottom,
    drawFromTop,
    putOnTop,
    putPileOnTop,
    putUnderneath,
    putUnderTop,
    recordAfterBottomDraw,
    recordAfterTopDraw,
    recordLifted,
    recordWithEntry,
    recordWithPileOnTop,
    topCards,
    topFirst,
    topIndexFromBottom,
    topOf,
    trimUnknownTop
} from './pileOrder.js'

describe('a stack, top first', () => {
    it('its top is its first entry, and an empty stack has none', () => {
        expect(topOf(['top', 'middle', 'bottom'])).toBe('top')
        expect(topOf([])).toBeUndefined()
    })

    it('shows its top cards, top first, without taking them', () => {
        const stack = ['top', 'middle', 'bottom']
        expect(topCards(stack, 2)).toEqual(['top', 'middle'])
        expect(topCards(stack, 5)).toEqual(['top', 'middle', 'bottom'])
        expect(topCards([], 2)).toEqual([])
        expect(stack).toEqual(['top', 'middle', 'bottom'])
    })

    it('draws from the top, top card first', () => {
        const stack = ['top', 'middle', 'bottom']
        expect(drawFromTop(stack, 2)).toEqual(['top', 'middle'])
        expect(stack).toEqual(['bottom'])
    })

    it('draws the whole stack from the top when asked for more than it holds', () => {
        const stack = ['top', 'bottom']
        expect(drawFromTop(stack, 5)).toEqual(['top', 'bottom'])
        expect(stack).toEqual([])
        expect(drawFromTop(stack, 1)).toEqual([])
    })

    it('draws nothing from the top for a count of none or less', () => {
        const stack = ['top', 'bottom']
        expect(drawFromTop(stack, 0)).toEqual([])
        expect(drawFromTop(stack, -1)).toEqual([])
        expect(stack).toEqual(['top', 'bottom'])
    })

    it('draws from the bottom, deepest card first', () => {
        const stack = ['top', 'middle', 'bottom']
        expect(drawFromBottom(stack, 2)).toEqual(['bottom', 'middle'])
        expect(stack).toEqual(['top'])
    })

    it('draws the whole stack from the bottom when asked for more than it holds', () => {
        const stack = ['top', 'bottom']
        expect(drawFromBottom(stack, 5)).toEqual(['bottom', 'top'])
        expect(stack).toEqual([])
        expect(drawFromBottom(stack, 1)).toEqual([])
    })

    it('draws nothing from the bottom for a count of none or less', () => {
        const stack = ['top', 'bottom']
        expect(drawFromBottom(stack, 0)).toEqual([])
        expect(drawFromBottom(stack, -1)).toEqual([])
        expect(stack).toEqual(['top', 'bottom'])
    })

    it('puts cards on top one at a time, so the last given ends on top', () => {
        const stack = ['old']
        putOnTop(stack, ['first', 'second'])
        expect(stack).toEqual(['second', 'first', 'old'])
        const empty: string[] = []
        putOnTop(empty, ['first', 'second'])
        expect(empty).toEqual(['second', 'first'])
    })

    it('puts cards underneath one at a time, so the last given ends at the bottom', () => {
        const stack = ['old']
        putUnderneath(stack, ['first', 'second'])
        expect(stack).toEqual(['old', 'first', 'second'])
        const empty: string[] = []
        putUnderneath(empty, ['first', 'second'])
        expect(empty).toEqual(['first', 'second'])
    })

    it('puts cards under its top cards, the last given nearest them', () => {
        const stack = ['top', 'next', 'bottom']
        putUnderTop(stack, ['first', 'second'], 2)
        expect(stack).toEqual(['top', 'next', 'second', 'first', 'bottom'])
    })

    it('puts cards under none of its cards on top, and under all of them at its bottom', () => {
        const onTop = ['top', 'bottom']
        putUnderTop(onTop, ['first', 'second'], 0)
        expect(onTop).toEqual(['second', 'first', 'top', 'bottom'])
        const atBottom = ['top', 'bottom']
        putUnderTop(atBottom, ['first', 'second'], 2)
        expect(atBottom).toEqual(['top', 'bottom', 'second', 'first'])
    })

    it('takes a whole pile set on top in that pile’s own order', () => {
        const stack = ['old top', 'old bottom']
        putPileOnTop(stack, ['pile top', 'pile bottom'])
        expect(stack).toEqual(['pile top', 'pile bottom', 'old top', 'old bottom'])
        const empty: string[] = []
        putPileOnTop(empty, ['pile top', 'pile bottom'])
        expect(empty).toEqual(['pile top', 'pile bottom'])
        putPileOnTop(empty, [])
        expect(empty).toEqual(['pile top', 'pile bottom'])
    })
})

describe('places, from the top and from the bottom', () => {
    it('turns a place from the top into one from the bottom', () => {
        expect(bottomIndexFromTop(3, 0)).toBe(2)
        expect(bottomIndexFromTop(3, 2)).toBe(0)
        expect(bottomIndexFromTop(1, 0)).toBe(0)
    })

    it('turns a place from the bottom into one from the top', () => {
        expect(topIndexFromBottom(3, 0)).toBe(2)
        expect(topIndexFromBottom(3, 2)).toBe(0)
        expect(topIndexFromBottom(1, 0)).toBe(0)
    })

    it('comes back to the same place both ways', () => {
        for (let place = 0; place < 4; place++) {
            expect(topIndexFromBottom(4, bottomIndexFromTop(4, place))).toBe(place)
            expect(bottomIndexFromTop(4, topIndexFromBottom(4, place))).toBe(place)
        }
    })

    it('gives the top of an empty stack no place from the bottom', () => {
        expect(bottomIndexFromTop(0, 0)).toBe(-1)
    })

    it('turns a bottom-first list into a top-first one', () => {
        expect(topFirst(['bottom', 'middle', 'top'])).toEqual(['top', 'middle', 'bottom'])
        expect(topFirst([])).toEqual([])
        const list = ['bottom', 'top']
        topFirst(list)
        expect(list).toEqual(['bottom', 'top'])
    })

    it('turns a top-first list into a bottom-first one', () => {
        expect(bottomFirst(['top', 'middle', 'bottom'])).toEqual(['bottom', 'middle', 'top'])
        expect(bottomFirst([])).toEqual([])
        const list = ['top', 'bottom']
        bottomFirst(list)
        expect(list).toEqual(['top', 'bottom'])
    })
})

describe('a record of known places, bottom first', () => {
    it('writes an entry at a place from the bottom, unknown places filling the gap', () => {
        expect(recordWithEntry(['b'], 2, 't')).toEqual(['b', null, 't'])
        expect(recordWithEntry(['b', 'm', 't'], 1, null)).toEqual(['b', null, 't'])
        expect(recordWithEntry([], 0, 'only')).toEqual(['only'])
    })

    it('splits a top draw into the drawn places and the rest', () => {
        expect(recordAfterTopDraw(['b', 'm', 't'], 1, 3)).toEqual({
            drawn: ['m', 't'],
            kept: ['b']
        })
        expect(recordAfterTopDraw(['b'], 1, 3)).toEqual({ drawn: [], kept: ['b'] })
        expect(recordAfterTopDraw(['b', 't'], 0, 2)).toEqual({ drawn: ['b', 't'], kept: [] })
        expect(recordAfterTopDraw([], 0, 2)).toEqual({ drawn: [], kept: [] })
    })

    it('splits a bottom draw into the drawn places and the rest', () => {
        expect(recordAfterBottomDraw(['b', 'm', 't'], 2)).toEqual({
            drawn: ['b', 'm'],
            kept: ['t']
        })
        expect(recordAfterBottomDraw(['b', 't'], 5)).toEqual({ drawn: ['b', 't'], kept: [] })
        expect(recordAfterBottomDraw([], 1)).toEqual({ drawn: [], kept: [] })
    })

    it('lifts every known place from a point up by the cards slipped in there', () => {
        expect(recordLifted(['b', 't'], 1, 2)).toEqual(['b', null, null, 't'])
        expect(recordLifted(['b', 't'], 0, 1)).toEqual([null, 'b', 't'])
        expect(recordLifted([], 0, 2)).toEqual([null, null])
    })

    it('sets a pile’s record on top of a stack’s, unknown places filling up to its size', () => {
        expect(recordWithPileOnTop(['b'], 3, ['p'])).toEqual(['b', null, null, 'p'])
        expect(recordWithPileOnTop([], 2, ['p', 'q'])).toEqual([null, null, 'p', 'q'])
        expect(recordWithPileOnTop(['b', 't'], 2, [])).toEqual(['b', 't'])
        expect(recordWithPileOnTop([], 0, [])).toEqual([])
    })

    it('drops unknown places above the highest known one', () => {
        expect(trimUnknownTop(['b', null, 't', null, null])).toEqual(['b', null, 't'])
        expect(trimUnknownTop([null, null])).toEqual([])
        expect(trimUnknownTop([])).toEqual([])
    })
})
