import { describe, expect, it } from 'vitest'
import {
    buildSlotRows,
    deckSlotCenterX,
    responsiveCardWidth,
    rowContentWidth
} from './politicsCardLayout.js'

const ROW_LEFT = 120

// Where slot 0 actually lands once PoliticsPileReveal lays the row out: each row is a centred
// flex row, so the first slot's centre sits half a card in from the row content's left edge.
// Derived from buildSlotRows' real output rather than from rowSizes, so this disagrees with
// deckSlotCenterX the moment the two stop splitting rows the same way.
function dealtDeckCenterX(cardCount: number, rowWidth: number, cardWidth: number): number {
    const cards = Array.from({ length: cardCount }, (_, index) => index)
    const firstRow = buildSlotRows(cards, rowWidth, cardWidth)[0]
    return ROW_LEFT + (rowWidth - rowContentWidth(firstRow.length, cardWidth)) / 2 + cardWidth / 2
}

describe('deckSlotCenterX', () => {
    // The chooser aims its slide here and hands the same point over as the deal's origin, both
    // before any dealt row exists to measure. If it stops agreeing with the layout that arrives,
    // the deck slides to the wrong place and the cards fly in from somewhere the deck never was.
    it('matches where buildSlotRows puts the deck, at every pile size and row width', () => {
        for (const rowWidth of [1200, 720, 480, 360, 300]) {
            const cardWidth = responsiveCardWidth(rowWidth)
            for (let cardCount = 1; cardCount <= 12; cardCount++) {
                expect(deckSlotCenterX(ROW_LEFT, rowWidth, cardCount, cardWidth)).toBeCloseTo(
                    dealtDeckCenterX(cardCount, rowWidth, cardWidth)
                )
            }
        }
    })

    it('predicts a slot the deck really occupies', () => {
        for (const rowWidth of [1200, 360]) {
            const cardWidth = responsiveCardWidth(rowWidth)
            for (let cardCount = 1; cardCount <= 12; cardCount++) {
                const cards = Array.from({ length: cardCount }, (_, index) => index)
                expect(buildSlotRows(cards, rowWidth, cardWidth)[0][0].kind).toBe('deck')
            }
        }
    })

    it('centres the deck alone when it is the only slot in the row', () => {
        const cardWidth = responsiveCardWidth(1200)

        expect(deckSlotCenterX(ROW_LEFT, 1200, 0, cardWidth)).toBeCloseTo(ROW_LEFT + 1200 / 2)
    })

    it('seats the deck further left as the first row grows', () => {
        const cardWidth = responsiveCardWidth(1200)
        const oneCard = deckSlotCenterX(ROW_LEFT, 1200, 1, cardWidth)
        const sixCards = deckSlotCenterX(ROW_LEFT, 1200, 6, cardWidth)

        expect(sixCards).toBeLessThan(oneCard)
    })
})
