// @vitest-environment node
import { render } from 'svelte/server'
import { describe, expect, it } from 'vitest'
import SymbolKeyCard from './table/SymbolKeyCard.svelte'

const paint = {
    fill: 'var(--feudum-map-ink)',
    ink: 'var(--feudum-map-ink)',
    edge: 'var(--feudum-map-ink)',
    owner: "Ana's"
}

describe('Contract, Symbol key: the table vocabulary in one compact card', () => {
    const { body } = render(SymbolKeyCard, { props: { paint } })

    /** The caption of each entry, in order. */
    const captions = Array.from(body.matchAll(/data-key-caption[^>]*>([^<]*)</g), ([, text]) =>
        text.trim()
    )

    it('names every guild die, good, place, vessel and piece by its caption', () => {
        expect(captions).toEqual(
            expect.arrayContaining([
                'Farmer',
                'Monk',
                'saltpeter',
                'food',
                'shilling',
                "king's seal",
                'sulfur in a barrel',
                'outpost',
                'farm',
                'town',
                'feudum',
                'ship',
                'submersible',
                'flying machine',
                'region tile',
                'writ',
                'influence marker',
                'player disc',
                'pawn'
            ])
        )
    })

    it('says what a chip means by its colour, and what a badge says', () => {
        expect(captions).toEqual(
            expect.arrayContaining(['a cost or threat', 'yours to take', 'rank it gives'])
        )
        expect(body).toContain('data-chip-sample="rose"')
        expect(body).toContain('data-chip-sample="amber"')
        expect(body).toMatch(/data-badge[^>]*>M</)
    })

    it('is one labelled group, its sections headed', () => {
        expect(body).toContain('aria-label="Symbol key"')
        for (const heading of ['Guilds', 'Goods', 'Places', 'Vessels', 'Pieces', 'Marks']) {
            expect(body).toMatch(new RegExp(`<h3[^>]*>${heading}</h3>`))
        }
    })
})
