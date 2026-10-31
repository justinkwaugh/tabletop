import { readdirSync, readFileSync, statSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const fontsDir = new URL('.', import.meta.url)
const OSWALD = ['Oswald-500.woff2', 'Oswald-600.woff2']
const CASLON = ['LibreCaslonText-400.woff2', 'LibreCaslonText-400-italic.woff2']

const gameTable = readFileSync(new URL('../components/GameTable.svelte', import.meta.url), 'utf8')

/** Art plan, "Fonts" and "Budget". */
describe('fonts', () => {
    it('ships Oswald 500 and 600 and Libre Caslon Text regular and italic as woff2, each family with its OFL text, and nothing else', () => {
        expect(
            readdirSync(fontsDir)
                .filter((file) => !file.endsWith('.spec.ts'))
                .sort()
        ).toEqual([...OSWALD, ...CASLON, 'LibreCaslonText-OFL.txt', 'Oswald-OFL.txt'].sort())
        for (const file of [...OSWALD, ...CASLON]) {
            expect(readFileSync(new URL(file, fontsDir)).toString('ascii', 0, 4), file).toBe('wOF2')
        }
        for (const [licence, family] of [
            ['Oswald-OFL.txt', 'Oswald'],
            ['LibreCaslonText-OFL.txt', 'Libre Caslon Text']
        ]) {
            const text = readFileSync(new URL(licence, fontsDir), 'utf8')
            expect(text, licence).toContain('SIL Open Font License, Version 1.1')
            expect(text, licence).toContain(`The ${family} Project Authors`)
        }
    })

    it('keeps each family within its font budget: Oswald 60 KB, Libre Caslon Text 40 KB', () => {
        const bytes = (files: string[]) =>
            files
                .map((file) => statSync(new URL(file, fontsDir)).size)
                .reduce((sum, size) => sum + size, 0)
        expect(bytes(OSWALD)).toBeLessThanOrEqual(60 * 1000)
        expect(bytes(CASLON)).toBeLessThanOrEqual(40 * 1000)
    })

    it('declares each face through CustomFont', () => {
        for (const weight of [500, 600]) {
            expect(gameTable).toMatch(
                new RegExp(
                    `<CustomFont fontFamily="Oswald" url=\\{Oswald${weight}\\} format="woff2" fontWeight=\\{${weight}\\} />`
                )
            )
        }
        for (const [name, style] of [
            ['Caslon400', 'normal'],
            ['Caslon400Italic', 'italic']
        ]) {
            expect(gameTable).toMatch(
                new RegExp(
                    `<CustomFont\\s+fontFamily="Libre Caslon Text"\\s+url=\\{${name}\\}\\s+format="woff2"\\s+fontWeight=\\{400\\}\\s+fontStyle="${style}"\\s*/>`
                )
            )
        }
    })
})
