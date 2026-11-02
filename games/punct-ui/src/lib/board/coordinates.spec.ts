import { describe, expect, it } from 'vitest'
import { SPACES, spaceAt } from '@tabletop/punct'
import { boardLabels, spaceLabel } from './coordinates.js'
import { TURNED_VIEW, VIEW } from './geometry.js'

describe('space names', () => {
    it('numbers each column up from 1 at its bottom space', () => {
        // BoardSpace's names, as the logic package keeps them, on the left.
        expect(spaceLabel(spaceAt('A2'))).toBe('A1')
        expect(spaceLabel(spaceAt('A8'))).toBe('A7')
        expect(spaceLabel(spaceAt('H16'))).toBe('H16')
        expect(spaceLabel(spaceAt('I9'))).toBe('I8')
        expect(spaceLabel(spaceAt('Q16'))).toBe('Q7')
        expect(new Set(SPACES.map(spaceLabel)).size).toBe(SPACES.length)
    })

    it('labels each column with its bottom space below it and its top number above it', () => {
        const texts = boardLabels(VIEW).map((label) => label.text)
        expect(texts.slice(0, 17)).toEqual([...'ABCDEFGHIJKLMNOPQ'].map((column) => `${column}1`))
        expect(texts.slice(17)).toEqual([
            '7',
            '10',
            '11',
            '12',
            '13',
            '14',
            '15',
            '16',
            '15',
            '16',
            '15',
            '14',
            '13',
            '12',
            '11',
            '10',
            '7'
        ])
    })

    it('puts the bottom labels at the far side once the board is turned', () => {
        const below = boardLabels(VIEW).find((label) => label.text === 'A1')
        const turned = boardLabels(TURNED_VIEW).find((label) => label.text === 'A1')
        expect(below?.at.y).toBeGreaterThan(0)
        expect(turned?.at.y).toBeLessThan(0)
        expect(turned?.at.x).toBeGreaterThan(0)
    })
})
