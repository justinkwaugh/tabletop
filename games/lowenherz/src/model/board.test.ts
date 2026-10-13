import { describe, expect, it } from 'vitest'
import { parseSquareKey, regionCentroidSquareKey, squareKey } from './board.js'

describe('square keys', () => {
    it('parses a square key back into its column and row', () => {
        expect(parseSquareKey(squareKey(12, 3))).toEqual([12, 3])
    })

    it('rejects a malformed square key', () => {
        expect(() => parseSquareKey('12')).toThrow(/Invalid square key/)
        expect(() => parseSquareKey('1,2,3')).toThrow(/Invalid square key/)
    })

    it('averages a region of squares into its centroid key', () => {
        expect(regionCentroidSquareKey(['0,0', '2,0', '1,3'])).toBe('1,1')
    })
})
