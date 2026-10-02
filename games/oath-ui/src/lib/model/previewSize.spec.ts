import { describe, expect, it } from 'vitest'
import { previewSourceWidth, previewWidth } from './previewSize.js'

const DESKTOP = { width: 1440, height: 900 }
const PHONE = { width: 390, height: 844 }

describe('the enlarged card’s size (item 12)', () => {
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
        expect(previewWidth({ width: 1440, height: 400 }, 770 / 596, 770)).toBe(Math.round(400 * 0.82 * (770 / 596)))
    })

    it('reads the source width from the card: banners, Visions and sites are wide', () => {
        expect(previewSourceWidth({ imageSrc: 'banner.jpg', aspect: 2 })).toBe(920)
        expect(previewSourceWidth({ cardId: 'vision.conquest' })).toBe(1016)
        expect(previewSourceWidth({ cardId: 'site.river' })).toBe(770)
        expect(previewSourceWidth({ cardId: 'denizen.hearth.book-binders' })).toBeUndefined()
    })
})
