import { describe, expect, it } from 'vitest'
import { pagedScale, previewSourceWidth, previewWidth } from './previewSize.js'

const DESKTOP = { width: 1440, height: 900 }
const PHONE = { width: 390, height: 844 }

describe('the enlarged card’s size (scenario 52)', () => {
    it('a wide card runs to its source art on a desktop', () => {
        expect(previewWidth(DESKTOP, 2, 920)).toBe(920)
        expect(previewWidth(DESKTOP, 1016 / 651, 1016)).toBe(1016)
        expect(previewWidth(DESKTOP, 770 / 596, 770)).toBe(770)
    })

    it('an upright card keeps 460 px on a desktop', () => {
        expect(previewWidth(DESKTOP, 651 / 1016, undefined)).toBe(460)
    })

    it('every card uses 0.8 of a phone’s width', () => {
        expect(previewWidth(PHONE, 2, 920)).toBe(312)
        expect(previewWidth(PHONE, 651 / 1016, undefined)).toBe(312)
    })

    it('stays inside the height of a short area', () => {
        expect(previewWidth({ width: 1440, height: 400 }, 770 / 596, 770)).toBe(
            Math.round(400 * 0.82 * (770 / 596))
        )
    })

    it('reads the source width from the card: banners, Visions and sites are wide', () => {
        expect(previewSourceWidth({ imageSrc: 'banner.jpg', aspect: 2 })).toBe(920)
        expect(previewSourceWidth({ cardId: 'vision.conquest' })).toBe(1016)
        expect(previewSourceWidth({ cardId: 'site.river' })).toBe(770)
        expect(previewSourceWidth({ cardId: 'denizen.hearth.book-binders' })).toBeUndefined()
    })
})

describe('rule 4 — three across on a desktop', () => {
    it('keeps an upright card and its sides at full size where they fit', () => {
        expect(pagedScale(1280, 420, 0, [420, 420])).toBe(1)
        // An edifice's other side, 150 wide and 16 off the card, still fits at 1280.
        expect(pagedScale(1280, 420, 166, [420])).toBe(1)
    })

    it('shrinks the three together when a Vision stands in the middle', () => {
        const scale = pagedScale(1280, 1016, 0, [420])
        expect(Math.round(1016 * scale)).toBe(802)
        expect(Math.round(420 * 0.6 * scale)).toBe(199)
    })
})
