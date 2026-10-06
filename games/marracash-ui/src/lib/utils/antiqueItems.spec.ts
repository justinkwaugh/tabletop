import { describe, expect, it } from 'vitest'
import { MarketColor } from '@tabletop/marracash'
import { antiqueColorSummary, missingAntiquesSummary, sortedAntiques } from './antiqueItems.js'

function cards(...colors: MarketColor[]) {
    return colors.map((color, index) => ({ color, value: 50 + 25 * index }))
}

describe('antique colour summary', () => {
    it('counts runs of the same colour in the order the cards are shown', () => {
        const hand = cards(
            MarketColor.Red,
            MarketColor.Green,
            MarketColor.Green,
            MarketColor.Purple,
            MarketColor.Purple
        )
        expect(antiqueColorSummary(hand)).toBe('Red, 2x Green, 2x Purple')
    })

    it('names a colour again when it reappears after another colour', () => {
        expect(
            antiqueColorSummary(cards(MarketColor.Blue, MarketColor.Yellow, MarketColor.Blue))
        ).toBe('Blue, Yellow, Blue')
    })

    it('groups each colour once after sorting by market colour, then by value', () => {
        const hand = [
            { color: MarketColor.Red, value: 150 },
            { color: MarketColor.Blue, value: 100 },
            { color: MarketColor.Yellow, value: 200 },
            { color: MarketColor.Red, value: 50 }
        ]
        expect(sortedAntiques(hand)).toEqual([
            { color: MarketColor.Red, value: 50 },
            { color: MarketColor.Red, value: 150 },
            { color: MarketColor.Blue, value: 100 },
            { color: MarketColor.Yellow, value: 200 }
        ])
        expect(antiqueColorSummary(sortedAntiques(hand))).toBe('2x Red, Blue, Yellow')
    })

    it('lists only the cards still missing a customer', () => {
        const [red, green, purple] = cards(MarketColor.Red, MarketColor.Green, MarketColor.Purple)
        const progress = [
            { card: red, covered: false },
            { card: green, covered: true },
            { card: purple, covered: false },
            { card: { ...purple, value: 200 }, covered: false }
        ]
        expect(missingAntiquesSummary(progress)).toBe('Missing: Red, 2x Purple')
        expect(missingAntiquesSummary(progress.map((entry) => ({ ...entry, covered: true })))).toBe(
            'Set complete'
        )
    })
})
