import { describe, expect, it } from 'vitest'
import { boxHolds } from './boundingBox.js'

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
