import { describe, expect, it } from 'vitest'

const components = import.meta.glob<string>('./*.svelte', {
    query: '?raw',
    import: 'default',
    eager: true
})

const DROPDOWN = /<select\b/g

/**
 * Taps, never dropdowns: every pick is a row, a chip, a card or a lit site. A power's choice has
 * no generic dropdown to fall back on; each kind it can ask has its own picker
 * (`powerPickerReach.spec.ts`). "To which site" is rows or the lit map (`PlayToSites.svelte`).
 */
describe('dropdowns', () => {
    it('no component draws one', () => {
        const offending = Object.entries(components).flatMap(([path, source]) =>
            [...source.matchAll(DROPDOWN)].map((match) => `${path}: ${match[0]}`)
        )
        expect(offending).toEqual([])
    })
})
