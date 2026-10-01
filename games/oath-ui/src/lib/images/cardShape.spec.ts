import { describe, expect, it } from 'vitest'
import { CardKind } from '@tabletop/oath'
import { CARD_ASPECT, cardAspect } from './cardShape.js'

/** R-9.4 — a facedown card is drawn and sized by the back it shows, never by its own id. */
describe('card shape', () => {
    it('a Vision shown by its back is the portrait back, whatever its id', () => {
        expect(cardAspect({ back: CardKind.Vision })).toBe(CARD_ASPECT[CardKind.Vision])
        expect(cardAspect({ cardId: 'vision.conquest', back: CardKind.Vision })).toBe(CARD_ASPECT[CardKind.Vision])
    })

    it('a Vision shown by its face is landscape', () => {
        expect(cardAspect({ cardId: 'vision.conquest' })).toBeGreaterThan(1)
    })
})
