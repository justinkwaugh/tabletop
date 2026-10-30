import { readdirSync, readFileSync, statSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const fontsDir = new URL('.', import.meta.url)
const gameTable = readFileSync(new URL('../components/GameTable.svelte', import.meta.url), 'utf8')

/** Art plan, "Fonts" and "Budget". */
describe('fonts', () => {
    it('ships Oswald 500 and 600 as woff2 with its OFL text, and nothing else', () => {
        expect(
            readdirSync(fontsDir)
                .filter((file) => !file.endsWith('.spec.ts'))
                .sort()
        ).toEqual(['Oswald-500.woff2', 'Oswald-600.woff2', 'Oswald-OFL.txt'])
        for (const file of ['Oswald-500.woff2', 'Oswald-600.woff2']) {
            expect(readFileSync(new URL(file, fontsDir)).toString('ascii', 0, 4), file).toBe('wOF2')
        }
        expect(readFileSync(new URL('Oswald-OFL.txt', fontsDir), 'utf8')).toContain(
            'SIL Open Font License, Version 1.1'
        )
    })

    it('keeps both faces within the 60 KB font budget', () => {
        const bytes = ['Oswald-500.woff2', 'Oswald-600.woff2']
            .map((file) => statSync(new URL(file, fontsDir)).size)
            .reduce((sum, size) => sum + size, 0)
        expect(bytes).toBeLessThanOrEqual(60 * 1000)
    })

    it('declares each face through CustomFont', () => {
        for (const weight of [500, 600]) {
            expect(gameTable).toMatch(
                new RegExp(
                    `<CustomFont fontFamily="Oswald" url=\\{Oswald${weight}\\} format="woff2" fontWeight=\\{${weight}\\} />`
                )
            )
        }
    })
})
