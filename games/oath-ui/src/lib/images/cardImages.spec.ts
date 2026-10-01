import { describe, expect, it } from 'vitest'
import { CardKind, cardIdsOfKind } from '@tabletop/oath'
import { cardBack, cardBackKeys, cardImage, cardImageKeys } from './cardImages.js'

/** Every extracted card has art, and every image is named for a real card. */
describe('card art coverage', () => {
    const simpleKinds = [CardKind.Denizen, CardKind.Site, CardKind.Relic, CardKind.Vision]

    it('every denizen, site, relic and Vision resolves to an image', () => {
        const missing: string[] = []
        for (const kind of simpleKinds) {
            for (const id of cardIdsOfKind(kind)) {
                if (!cardImage(id)) missing.push(id)
            }
        }
        expect(missing).toEqual([])
    })

    it('no image is orphaned — every file names a card that exists', () => {
        const known = new Set<string>()
        for (const kind of simpleKinds) {
            for (const id of cardIdsOfKind(kind)) known.add(id)
        }
        const orphans = cardImageKeys().filter((key) => !known.has(key))
        expect(orphans).toEqual([])
    })

    it('R-9.4 — denizen and Vision backs both exist and are distinguishable', () => {
        // The top world-deck card's back is public, and it is how a player knows a Vision is next.
        const denizen = cardBack(CardKind.Denizen)
        const vision = cardBack(CardKind.Vision)
        expect(denizen).toBeDefined()
        expect(vision).toBeDefined()
        expect(denizen).not.toBe(vision)
    })

    it('every kind dealt facedown has a back of its own', () => {
        // R-1.1, R-2.8.2 — sites are dealt facedown, and relics sit facedown at sites.
        for (const kind of [CardKind.Denizen, CardKind.Vision, CardKind.Site, CardKind.Relic]) {
            expect(cardBackKeys()).toContain(kind)
        }
    })

    it('no kind falls back to the denizen back', () => {
        expect(cardBack(undefined)).toBe(cardBack(CardKind.Denizen))
    })
})
