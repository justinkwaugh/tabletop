import { describe, expect, it } from 'vitest'
import { BoardLayout, layoutCoordinates } from '@tabletop/zertz'
import { boardNotation } from './coordinates.js'

describe('boardNotation', () => {
    const standard = boardNotation(layoutCoordinates(BoardLayout.Rings37))

    it.each([
        [{ q: -3, r: 3 }, 'A1'],
        [{ q: -3, r: 0 }, 'A4'],
        [{ q: 0, r: 3 }, 'D1'],
        [{ q: 0, r: 0 }, 'D4'],
        [{ q: 0, r: -3 }, 'D7'],
        [{ q: 3, r: 0 }, 'G1'],
        [{ q: 3, r: -3 }, 'G4']
    ])('names %o as %s on the 37 ring board', (coords, name) => {
        expect(standard.name(coords)).toBe(name)
    })

    it('labels each column with its bottom ring below and its top ring above', () => {
        const texts = standard.labels.map((label) => label.text)
        expect(texts.toSorted()).toEqual(
            [
                'A1',
                'A4',
                'B1',
                'B5',
                'C1',
                'C6',
                'D1',
                'D7',
                'E1',
                'E6',
                'F1',
                'F5',
                'G1',
                'G4'
            ].toSorted()
        )
    })

    it('names the extra column and longer columns of the 48 ring board', () => {
        const tournament = boardNotation(layoutCoordinates(BoardLayout.Rings48))
        expect(tournament.name({ q: 0, r: 4 })).toBe('D1')
        expect(tournament.name({ q: 0, r: -3 })).toBe('D8')
        expect(tournament.name({ q: 4, r: 0 })).toBe('H1')
        expect(tournament.name({ q: 4, r: -3 })).toBe('H4')
    })
})
