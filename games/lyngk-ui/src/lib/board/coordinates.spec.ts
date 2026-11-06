import { describe, expect, it } from 'vitest'
import { POINTS } from '@tabletop/lyngk'
import { boardNotation } from './coordinates.js'
import { VIEW, viewOf } from './geometry.js'

describe('boardNotation', () => {
    const notation = boardNotation(POINTS)

    it.each([
        [{ q: -4, r: 2 }, 'A1'],
        [{ q: -3, r: 3 }, 'B1'],
        [{ q: -3, r: 0 }, 'B4'],
        [{ q: -2, r: 4 }, 'C1'],
        [{ q: -2, r: -2 }, 'C7'],
        [{ q: 0, r: 3 }, 'E1'],
        [{ q: 0, r: 0 }, 'E4'],
        [{ q: 0, r: -3 }, 'E7'],
        [{ q: 2, r: -4 }, 'G7'],
        [{ q: 4, r: -2 }, 'I1']
    ])('names %o as %s', (coords, name) => {
        expect(notation.name(coords)).toBe(name)
    })

    it('labels each column with its bottom and top points, the tips once', () => {
        expect(notation.labels.map((label) => label.text).toSorted()).toEqual(
            [
                'A1',
                'B1',
                'B4',
                'C1',
                'C7',
                'D1',
                'D6',
                'E1',
                'E7',
                'F1',
                'F6',
                'G1',
                'G7',
                'H1',
                'H4',
                'I1'
            ].toSorted()
        )
    })

    it('turns the board half round, keeping each label beyond its column', () => {
        const turned = boardNotation(POINTS, viewOf(true))
        const at = (labels: typeof notation.labels, key: string) =>
            labels.find((label) => label.key === key)!.at
        expect(turned.labels.map((label) => label.text)).toEqual(
            notation.labels.map((label) => label.text)
        )
        for (const label of notation.labels) {
            expect(at(turned.labels, label.key).x).toBeCloseTo(-label.at.x)
        }
        // E1, nearest you below the board, goes where E7's label was, beyond the far end.
        expect(at(turned.labels, 'bottom-E').y).toBeCloseTo(at(notation.labels, 'top-E').y)
        expect(at(turned.labels, 'top-E').y).toBeCloseTo(at(notation.labels, 'bottom-E').y)
        // A side tip's label stays below it.
        const tip = VIEW.center({ q: 4, r: -2 })
        expect(at(turned.labels, 'bottom-A').y - tip.y).toBeCloseTo(
            at(notation.labels, 'bottom-I').y - tip.y
        )
    })
})
