import { describe, expect, it } from 'vitest'
import type { Point } from '@tabletop/common'
import {
    aroundArc,
    grownOutline,
    outlinesOverlap,
    overlapWhileSliding,
    shortestClearSlide,
    strokeOutline,
    type ConvexOutline
} from './convexOutline.js'
import { cornersOf } from './orientedBox.js'

const EAST = { x: 1, y: 0 }
const SOUTH = { x: 0, y: 1 }
const DIAGONAL = { x: Math.SQRT1_2, y: Math.SQRT1_2 }

function box(x: number, y: number, along = EAST, halfLength = 10, halfWidth = 5): Point[] {
    return cornersOf({ centre: { x, y }, along, halfLength, halfWidth })
}

describe('sliding one outline past another', () => {
    it('overlaps over the slides that bring their edges past each other', () => {
        const range = overlapWhileSliding(box(0, 0), box(50, 0), EAST)
        expect(range?.[0]).toBeCloseTo(30)
        expect(range?.[1]).toBeCloseTo(70)
    })

    it('never overlaps when the line of the slide passes beside the other outline', () => {
        expect(overlapWhileSliding(box(0, 0), box(50, 20), EAST)).toBeUndefined()
    })

    it('measures a turned outline by its corners', () => {
        const range = overlapWhileSliding(box(0, 0), box(0, 30, DIAGONAL, 10, 1), SOUTH)
        expect(range?.[0]).toBeCloseTo(30 - 5 - (10 + 1) * Math.SQRT1_2)
    })

    it('meets a triangle at its slanted side, not at the box round it', () => {
        const triangle = [
            { x: 0, y: -20 },
            { x: 20, y: 0 },
            { x: 0, y: 20 }
        ]
        const range = overlapWhileSliding(box(-40, 15), triangle, EAST)
        expect(range?.[1]).toBeCloseTo(40 + 10 + 10)
    })
})

describe('the shortest clear slide', () => {
    it('is none for an outline already clear', () => {
        expect(shortestClearSlide(box(0, 0), [box(50, 0)], EAST)).toBe(0)
    })

    it('goes out the nearer side of an obstacle', () => {
        expect(shortestClearSlide(box(0, 0), [box(5, 0)], EAST)).toBeCloseTo(-15)
        expect(shortestClearSlide(box(0, 0), [box(-5, 0)], EAST)).toBeCloseTo(15)
    })

    it('does not stop inside another obstacle', () => {
        expect(shortestClearSlide(box(0, 0), [box(5, 0), box(-25, 0)], EAST)).toBeCloseTo(25)
    })

    it('takes the way towards the right of the board, or down it, between two of a length', () => {
        expect(shortestClearSlide(box(0, 0), [box(0, 0)], EAST)).toBeCloseTo(20)
        expect(shortestClearSlide(box(0, 0), [box(0, 0)], { x: -1, y: 0 })).toBeCloseTo(-20)
        expect(
            shortestClearSlide(box(0, 0, SOUTH), [box(0, 0, SOUTH)], { x: 0, y: -1 })
        ).toBeCloseTo(-20)
    })
})

describe('a grown outline', () => {
    it('stands the distance out from every side, whichever way round it runs', () => {
        const square: ConvexOutline = box(0, 0, EAST, 10, 10)
        for (const outline of [square, square.toReversed()]) {
            const xs = grownOutline(outline, 2).map(({ x }) => x)
            expect(Math.max(...xs)).toBeCloseTo(12)
            expect(Math.min(...xs)).toBeCloseTo(-12)
        }
    })
})

describe('the outline round an arc', () => {
    it('touches the arc at its ends and stands off it nowhere by more than the steps allow', () => {
        const corners = aroundArc({ x: 0, y: 0 }, 10, 0, 90, 2)
        expect(corners[0].x).toBeCloseTo(10)
        expect(corners.at(-1)?.y).toBeCloseTo(10)
        for (const { x, y } of corners) {
            expect(Math.hypot(x, y)).toBeGreaterThanOrEqual(10 - 1e-9)
            expect(Math.hypot(x, y)).toBeLessThanOrEqual(10 / Math.cos(Math.PI / 8) + 1e-9)
        }
    })
})

describe('the outline of a straight stroke', () => {
    it('runs from end to end at the given half width on either side', () => {
        const stroke = strokeOutline({ x: 0, y: 0 }, { x: 10, y: 0 }, 2)
        expect(stroke.map(({ x, y }) => ({ x, y: y + 0 }))).toEqual([
            { x: 0, y: 2 },
            { x: 10, y: 2 },
            { x: 10, y: -2 },
            { x: 0, y: -2 }
        ])
        const touching = cornersOf({
            centre: { x: 5, y: 3 },
            along: EAST,
            halfLength: 1,
            halfWidth: 1.5
        })
        const clear = cornersOf({
            centre: { x: 5, y: 5 },
            along: EAST,
            halfLength: 1,
            halfWidth: 1.5
        })
        expect(outlinesOverlap(stroke, touching)).toBe(true)
        expect(outlinesOverlap(stroke, clear)).toBe(false)
    })
})
