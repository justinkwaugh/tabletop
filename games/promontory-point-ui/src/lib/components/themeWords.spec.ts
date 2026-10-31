import { describe, expect, it } from 'vitest'

const sources = import.meta.glob<string>(
    ['../**/*.svelte', '../**/*.ts', '!../**/*.spec.ts', '!../**/*.d.ts'],
    { query: '?raw', import: 'default', eager: true }
)

// R-0, R-0-H1: the rulebook's words, each with the theme's name the UI uses instead.
const RULEBOOK_WORDS: Record<string, RegExp> = {
    'entertainer (share)': /\bentertainers?\b/i,
    'sponsor (buy)': /\bsponsor(?:s|ed|ing)?\b/i,
    'ducats (dollars)': /\bducats?\b/i,
    'reputation (share price)': /\breputation\b/i,
    'travel marker (track piece)': /\btravel markers?\b/i,
    'Pay day (Dividend)': /\bpay ?day\b/i,
    'Illness (Repairs)': /\billness\b/i
}

describe('theme words (R-0, R-0-H1)', () => {
    it('no component or model names a thing by the rulebook’s word', () => {
        expect(Object.keys(sources).length).toBeGreaterThan(20)
        const found = Object.entries(sources).flatMap(([path, source]) =>
            Object.entries(RULEBOOK_WORDS)
                .filter(([, pattern]) => pattern.test(source))
                .map(([word]) => `${path}: ${word}`)
        )
        expect(found).toEqual([])
    })

    it('the check catches each word', () => {
        for (const [word, pattern] of Object.entries(RULEBOOK_WORDS)) {
            const sample = word.split(' (')[0]
            expect(pattern.test(`Pay for the ${sample} now`), word).toBe(true)
        }
    })
})
