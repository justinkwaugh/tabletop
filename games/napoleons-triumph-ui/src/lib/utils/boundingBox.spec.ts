import { describe, expect, it } from 'vitest'
import { boundsOfPoints, boxHolds, boxesOverlap } from './boundingBox.js'

describe('whether a box holds a point', () => {
    const box = { x: 10, y: 20, width: 30, height: 40 }

    it('holds the points inside it and on its edges', () => {
        expect(boxHolds(box, { x: 25, y: 40 })).toBe(true)
        expect(boxHolds(box, { x: 10, y: 20 })).toBe(true)
        expect(boxHolds(box, { x: 40, y: 60 })).toBe(true)
    })

    it('does not hold a point beyond any one edge', () => {
        expect(boxHolds(box, { x: 9, y: 40 })).toBe(false)
        expect(boxHolds(box, { x: 41, y: 40 })).toBe(false)
        expect(boxHolds(box, { x: 25, y: 19 })).toBe(false)
        expect(boxHolds(box, { x: 25, y: 61 })).toBe(false)
    })
})

describe('the bounds of points and whether two boxes overlap', () => {
    it('spans the points', () => {
        expect(
            boundsOfPoints([
                { x: 3, y: 8 },
                { x: -2, y: 4 },
                { x: 6, y: 1 }
            ])
        ).toEqual({ x: -2, y: 1, width: 8, height: 7 })
    })

    it('overlap only where they share area', () => {
        const box = { x: 0, y: 0, width: 10, height: 10 }
        expect(boxesOverlap(box, { x: 5, y: 5, width: 10, height: 10 })).toBe(true)
        expect(boxesOverlap(box, { x: 10, y: 0, width: 10, height: 10 })).toBe(false)
        expect(boxesOverlap(box, { x: 0, y: 11, width: 10, height: 10 })).toBe(false)
    })
})
