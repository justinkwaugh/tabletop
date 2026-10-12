import { describe, expect, it } from 'vitest'
import { columnFill } from './columnFill.js'

describe('column fill', () => {
    it('keeps columns two deep while they fit', () => {
        expect(columnFill(1, 1200, 300, 2)).toEqual({ columns: 1, rows: 1 })
        expect(columnFill(2, 1200, 300, 2)).toEqual({ columns: 1, rows: 2 })
        expect(columnFill(5, 1200, 300, 2)).toEqual({ columns: 3, rows: 2 })
        expect(columnFill(8, 1200, 300, 2)).toEqual({ columns: 4, rows: 2 })
    })

    it('deepens the columns that fit when more would be needed', () => {
        expect(columnFill(5, 700, 300, 2)).toEqual({ columns: 2, rows: 3 })
        expect(columnFill(9, 1200, 300, 2)).toEqual({ columns: 4, rows: 3 })
    })

    it('falls back to a single list when only one column fits', () => {
        expect(columnFill(5, 350, 300, 2)).toEqual({ columns: 1, rows: 5 })
        expect(columnFill(5, 0, 300, 2)).toEqual({ columns: 1, rows: 5 })
        expect(columnFill(0, 1200, 300, 2)).toEqual({ columns: 1, rows: 1 })
    })
})
