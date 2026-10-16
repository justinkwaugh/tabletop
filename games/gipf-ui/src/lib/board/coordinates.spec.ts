import { describe, expect, it } from 'vitest'
import { ALL_POINTS } from '@tabletop/gipf'
import { boardNotation } from './coordinates.js'

describe('boardNotation', () => {
    const notation = boardNotation(ALL_POINTS)

    it.each([
        [{ q: -4, r: 4 }, 'A1'],
        [{ q: -4, r: 0 }, 'A5'],
        [{ q: 0, r: 4 }, 'E1'],
        [{ q: 0, r: 3 }, 'E2'],
        [{ q: 0, r: -4 }, 'E9'],
        [{ q: -3, r: 0 }, 'B5'],
        [{ q: 3, r: -3 }, 'H5'],
        [{ q: 4, r: 0 }, 'I1'],
        [{ q: 4, r: -4 }, 'I5']
    ])('names %o as %s', (coords, name) => {
        expect(notation.name(coords)).toBe(name)
    })

    it('labels each column with its bottom and top points', () => {
        expect(notation.labels.map((label) => label.text).toSorted()).toEqual(
            [
                'A1',
                'A5',
                'B1',
                'B6',
                'C1',
                'C7',
                'D1',
                'D8',
                'E1',
                'E9',
                'F1',
                'F8',
                'G1',
                'G7',
                'H1',
                'H6',
                'I1',
                'I5'
            ].toSorted()
        )
    })
})
