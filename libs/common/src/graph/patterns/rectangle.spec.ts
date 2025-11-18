import { describe, expect, it } from 'vitest'
import { rectangle } from './rectangle.js'

describe('Rectangle Pattern Tests', () => {
    it('generates solid rectangle', () => {
        const rectanglePattern = rectangle({
            start: { row: 0, col: 0 },
            width: 4,
            height: 3
        })
        const result = Array.from(rectanglePattern())
        expect(result).toEqual([
            { row: 0, col: 0 },
            { row: 0, col: 1 },
            { row: 0, col: 2 },
            { row: 0, col: 3 },
            { row: 1, col: 0 },
            { row: 1, col: 1 },
            { row: 1, col: 2 },
            { row: 1, col: 3 },
            { row: 2, col: 0 },
            { row: 2, col: 1 },
            { row: 2, col: 2 },
            { row: 2, col: 3 }
        ])
    })

    it('generates hollow rectangle', () => {
        const rectanglePattern = rectangle({
            start: { row: 0, col: 0 },
            width: 4,
            height: 3,
            solid: false
        })
        const result = Array.from(rectanglePattern())
        expect(result).toEqual([
            { row: 0, col: 0 },
            { row: 0, col: 1 },
            { row: 0, col: 2 },
            { row: 0, col: 3 },
            { row: 1, col: 3 },
            { row: 2, col: 3 },
            { row: 2, col: 2 },
            { row: 2, col: 1 },
            { row: 2, col: 0 },
            { row: 1, col: 0 }
        ])
    })

    it('generates hollow horizontal line rectangle', () => {
        const rectanglePattern = rectangle({
            start: { row: 0, col: 0 },
            width: 4,
            height: 1,
            solid: false
        })
        const result = Array.from(rectanglePattern())
        expect(result).toEqual([
            { row: 0, col: 0 },
            { row: 0, col: 1 },
            { row: 0, col: 2 },
            { row: 0, col: 3 }
        ])
    })

    it('generates hollow vertical line rectangle', () => {
        const rectanglePattern = rectangle({
            start: { row: 0, col: 0 },
            width: 1,
            height: 4,
            solid: false
        })
        const result = Array.from(rectanglePattern())
        expect(result).toEqual([
            { row: 0, col: 0 },
            { row: 1, col: 0 },
            { row: 2, col: 0 },
            { row: 3, col: 0 }
        ])
    })
})
