import { describe, expect, it } from 'vitest'
import { Suit } from '../model/oathEnums.js'
import { siteReference } from './siteReference.js'
import { ALL_SITE_IDS, HOMELAND_SITE_BY_SUIT, siteRecord } from './sites.js'

const TOKEN = /\[([^\]]*)\]/g
const KNOWN = new Set(['favor', 'secret', 'attackDie', ...Object.values(Suit).map((suit) => `suit:${suit}`)])

describe('R-11 — every site says what it does', () => {
    it('has one sentence for each of the 23 sites', () => {
        expect(ALL_SITE_IDS).toHaveLength(23)
        for (const id of ALL_SITE_IDS) expect(siteReference(id), id).toBeTruthy()
    })

    it('has no sentence for a card that is not a site', () => {
        expect(siteReference('denizen.arcane.alchemist')).toBeUndefined()
    })

    it('uses only the symbols the UI draws', () => {
        for (const id of ALL_SITE_IDS) {
            for (const [, token] of (siteReference(id) ?? '').matchAll(TOKEN)) expect(KNOWN, `${id}: [${token}]`).toContain(token)
        }
    })

    it('names a Homeland by its own suit', () => {
        for (const [suit, id] of Object.entries(HOMELAND_SITE_BY_SUIT)) {
            expect(siteReference(id), id).toContain(`[suit:${suit}] card to this site`)
            expect(siteRecord(id)?.homeland?.suit).toBe(suit)
        }
    })

    it('carries the Shrouded Wood errata and the corrected misprints', () => {
        expect(siteReference('site.shrouded-wood')).toContain('If an enemy player rules here')
        expect(siteReference('site.barren-coast')).toMatch(/Narrow Pass power\.$/)
        expect(siteReference('site.rocky-coast')).toMatch(/Narrow Pass power\.$/)
        expect(siteReference('site.wastes')).toContain('you take the relic here')
    })
})
