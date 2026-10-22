import { describe, expect, it } from 'vitest'

const components = import.meta.glob<string>('./*.svelte', {
    query: '?raw',
    import: 'default',
    eager: true
})

const DROPDOWN = /<select\b/g

/** The dropdowns still drawn: "Play to:" in Search and the facedown play, to become site rows. */
const DROPDOWNS_LEFT = ['./FacedownAdviserPlay.svelte', './SearchPanel.svelte']

/**
 * Taps, never dropdowns: every pick is a row, a chip or a card. A power's choice has no generic
 * dropdown to fall back on; each kind it can ask has its own picker (`powerPickerReach.spec.ts`).
 */
describe('dropdowns', () => {
    it('no component draws one but those listed', () => {
        const offending = Object.entries(components).flatMap(([path, source]) =>
            DROPDOWNS_LEFT.includes(path)
                ? []
                : [...source.matchAll(DROPDOWN)].map((match) => `${path}: ${match[0]}`)
        )
        expect(offending).toEqual([])
    })
})
