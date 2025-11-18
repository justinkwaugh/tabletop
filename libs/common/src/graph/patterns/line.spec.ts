import { describe, expect, it } from 'vitest'
import { linePattern } from './line.js'
import { CardinalDirection, OrdinalDirection } from '../directions.js'

describe('Line Pattern Tests', () => {
    it('generates cardinal vector coordinates', () => {
        const pattern = linePattern({
            start: { row: 0, col: 0 },
            direction: CardinalDirection.East,
            length: 3
        })
        const result = Array.from(pattern())
        expect(result).toEqual([
            { row: 0, col: 0 },
            { row: 0, col: 1 },
            { row: 0, col: 2 }
        ])
    })

    it('generates ordinal vector coordinates', () => {
        const pattern = linePattern({
            start: { row: 0, col: 0 },
            direction: OrdinalDirection.Northeast,
            length: 3
        })
        const result = Array.from(pattern())
        expect(result).toEqual([
            { row: 0, col: 0 },
            { row: -1, col: 1 },
            { row: -2, col: 2 }
        ])
    })
})
