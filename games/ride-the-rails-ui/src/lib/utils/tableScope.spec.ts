import { describe, expect, it } from 'vitest'
import { TABLE_ATTRIBUTE, findInTable } from './tableScope.js'

const SOURCES = import.meta.glob(
    ['../**/*.ts', '../**/*.svelte', '!../**/*.spec.ts', '!../testing/**'],
    { query: '?raw', import: 'default', eager: true }
)

describe('element queries stay inside the table', () => {
    it('reads the title’s sources', () => {
        expect(Object.keys(SOURCES).length).toBeGreaterThanOrEqual(90)
    })

    it('never queries the whole page', () => {
        const pageQueries = Object.entries(SOURCES)
            .filter(([, text]) =>
                /\b(?:document|ownerDocument)\s*\.\s*querySelector/.test(String(text))
            )
            .map(([file]) => file)
        expect(pageQueries).toEqual([])
    })

    it('marks the table GameTable draws and hands it to the flights', () => {
        const table = String(SOURCES['../components/GameTable.svelte'])
        expect(table).toMatch(new RegExp(`<div[^>]*\\b${TABLE_ATTRIBUTE}\\b[^>]*>`))
        expect(table).toMatch(/\{@attach session\.flights\.attachTable\}/)
    })

    it('finds nothing without a table', () => {
        expect(findInTable(undefined, '[data-railroad-choice]')).toBeUndefined()
    })
})
