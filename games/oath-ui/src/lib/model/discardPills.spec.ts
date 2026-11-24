import { describe, expect, it } from 'vitest'
import { discardPills, placeName } from './discardPills.js'

describe('R-9.4 — the pills on a discard pile', () => {
    it('no Vision: the count alone', () => {
        expect(discardPills('Cradle discard pile', 4, [])).toEqual({
            count: '4',
            label: 'Cradle discard pile: 4 cards'
        })
    })

    it('a Vision on top is "1"', () => {
        expect(discardPills('Hinterland discard pile', 7, [1])).toEqual({
            count: '7',
            places: '1',
            label: 'Hinterland discard pile: 7 cards; Vision 1st from the top'
        })
    })

    it('three Visions: "3 · 8 · 11", the label "3rd, 8th and 11th"', () => {
        expect(discardPills('Provinces discard pile', 16, [3, 8, 11])).toEqual({
            count: '16',
            places: '3 · 8 · 11',
            label: 'Provinces discard pile: 16 cards; Visions 3rd, 8th and 11th from the top'
        })
    })

    it('two Visions are joined by "and" alone', () => {
        expect(discardPills('Hinterland discard pile', 26, [6, 14]).label).toBe(
            'Hinterland discard pile: 26 cards; Visions 6th and 14th from the top'
        )
    })

    it('all five Visions in one pile, two digits each', () => {
        expect(discardPills('Hinterland discard pile', 26, [12, 15, 18, 21, 24])).toEqual({
            count: '26',
            places: '12 · 15 · 18 · 21 · 24',
            label: 'Hinterland discard pile: 26 cards; Visions 12th, 15th, 18th, 21st and 24th from the top'
        })
    })

    it('places not known (an older game): the count alone', () => {
        expect(discardPills('Provinces discard pile', 12, undefined)).toEqual({
            count: '12',
            label: 'Provinces discard pile: 12 cards'
        })
    })

    it('an empty pile: 0 cards', () => {
        expect(discardPills('Cradle discard pile', 0, [])).toEqual({
            count: '0',
            label: 'Cradle discard pile: 0 cards'
        })
    })

    it('one card is "1 card"', () => {
        expect(discardPills('Cradle discard pile', 1, []).label).toBe('Cradle discard pile: 1 card')
    })

    it('names places as they are said', () => {
        expect([1, 2, 3, 4, 10, 11, 12, 13, 21, 22, 23, 24, 101, 111].map(placeName)).toEqual([
            '1st',
            '2nd',
            '3rd',
            '4th',
            '10th',
            '11th',
            '12th',
            '13th',
            '21st',
            '22nd',
            '23rd',
            '24th',
            '101st',
            '111th'
        ])
    })
})
