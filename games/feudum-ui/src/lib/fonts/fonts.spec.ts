// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { FontFaces } from './fonts.js'

const folder = new URL('./', import.meta.url)
const files = readdirSync(folder)
const fonts = files.filter((name) => /\.(woff2|woff|ttf|otf)$/.test(name))

/** Readiness gate on licences; art plan, "Fonts": each family ships with its OFL text. */
describe('fonts', () => {
    it('every font file has its OFL text beside it', () => {
        expect(fonts.length).toBeGreaterThan(0)
        for (const font of fonts) {
            const licence = font.replace(/(-Latin)?\.(woff2|woff|ttf|otf)$/, '-OFL.txt')
            expect(files).toContain(licence)
            expect(readFileSync(new URL(licence, folder), 'utf8')).toContain(
                'SIL OPEN FONT LICENSE'
            )
        }
    })

    it('every file is a family the table sets through CustomFont', () => {
        expect(FontFaces).toHaveLength(fonts.length)
        expect(FontFaces.map(({ family }) => family)).toEqual(
            expect.arrayContaining(['MedievalSharp', 'IM Fell English'])
        )
    })

    it('a family whose licence reserves its name ships whole, under that name', () => {
        const licence = readFileSync(new URL('MedievalSharp-OFL.txt', folder), 'utf8')
        expect(licence).toContain('Reserved Font Name MedievalSharp')
        expect(fonts).toContain('MedievalSharp.woff2')
        expect(fonts.filter((name) => name.startsWith('MedievalSharp'))).toHaveLength(1)
    })

    it('every font ships as WOFF2, the web’s compressed form', () => {
        expect(fonts.filter((name) => !name.endsWith('.woff2'))).toEqual([])
        for (const font of fonts) {
            expect(readFileSync(new URL(font, folder)).subarray(0, 4).toString('latin1')).toBe(
                'wOF2'
            )
        }
    })
})
