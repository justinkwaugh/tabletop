import { describe, expect, it } from 'vitest'
import {
    buildSlotRows,
    cardHeightFor,
    CHOOSER_DECK_GAP,
    chooserDeckCenter,
    responsiveCardWidth
} from './politicsCardLayout.js'

const ROW = { left: 120, top: 40, width: 720 }

describe('buildSlotRows', () => {
    it('always seats the deck in the first slot', () => {
        for (const rowWidth of [1200, 360]) {
            const cardWidth = responsiveCardWidth(rowWidth)
            for (let cardCount = 1; cardCount <= 12; cardCount++) {
                const cards = Array.from({ length: cardCount }, (_, index) => index)
                expect(buildSlotRows(cards, rowWidth, cardWidth)[0][0].kind).toBe('deck')
            }
        }
    })
})

describe('chooserDeckCenter', () => {
    it('places pile A left and pile B right of the row centre, one gap apart', () => {
        const cardWidth = responsiveCardWidth(ROW.width)
        const a = chooserDeckCenter('A', ROW, cardWidth)
        const b = chooserDeckCenter('B', ROW, cardWidth)

        expect((a.x + b.x) / 2).toBeCloseTo(ROW.left + ROW.width / 2)
        expect(b.x - a.x).toBeCloseTo(cardWidth + CHOOSER_DECK_GAP)
    })

    it('centres the decks vertically on a card row starting at the row top', () => {
        const cardWidth = responsiveCardWidth(ROW.width)

        expect(chooserDeckCenter('A', ROW, cardWidth).y).toBeCloseTo(
            ROW.top + cardHeightFor(cardWidth) / 2
        )
    })
})
