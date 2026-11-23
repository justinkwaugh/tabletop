import { describe, expect, it } from 'vitest'
import { discardBoxLines, placeName } from './discardBox.js'

describe('R-9.4 — the box beside a discard pile', () => {
    it('12 cards with Visions 3rd and 8th from the top', () => {
        expect(discardBoxLines('Provinces discard pile', 12, [3, 8])).toEqual({
            count: '12',
            unit: 'cards',
            visions: { word: 'Visions', places: '3rd, 8th' },
            label: 'Provinces discard pile: 12 cards; Visions 3rd and 8th from the top'
        })
    })

    it('a Vision on top is the 1st', () => {
        expect(discardBoxLines('Hinterland discard pile', 7, [1]).visions).toEqual({
            word: 'Vision',
            places: '1st'
        })
    })

    it('no Vision: the count alone', () => {
        expect(discardBoxLines('Cradle discard pile', 4, [])).toEqual({
            count: '4',
            unit: 'cards',
            label: 'Cradle discard pile: 4 cards'
        })
    })

    it('an empty pile: 0 cards', () => {
        expect(discardBoxLines('Cradle discard pile', 0, [])).toMatchObject({
            count: '0',
            unit: 'cards'
        })
    })

    it('one card is "1 card"', () => {
        expect(discardBoxLines('Cradle discard pile', 1, []).unit).toBe('card')
    })

    it('places not known (an older game): the count alone', () => {
        expect(discardBoxLines('Provinces discard pile', 12, undefined)).toEqual({
            count: '12',
            unit: 'cards',
            label: 'Provinces discard pile: 12 cards'
        })
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
