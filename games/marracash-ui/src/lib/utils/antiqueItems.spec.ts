import { describe, expect, it } from 'vitest'
import { MarketColor } from '@tabletop/marracash'
import { antiqueColorSummary } from './antiqueItems.js'

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
})
