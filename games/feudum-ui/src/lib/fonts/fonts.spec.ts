// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { FontFaces } from './fonts.js'

const folder = new URL('./', import.meta.url)
const files = readdirSync(folder)
const fonts = files.filter((name) => name.endsWith('.woff2'))

/** Readiness gate on licences; art plan, "Fonts": each family ships with its OFL text. */
describe('fonts', () => {
    it('every font file has its OFL text beside it', () => {
        expect(fonts.length).toBeGreaterThan(0)
        for (const font of fonts) {
            const licence = font.replace('-Latin.woff2', '-OFL.txt')
            expect(files).toContain(licence)
            expect(readFileSync(new URL(licence, folder), 'utf8')).toContain(
                'SIL OPEN FONT LICENSE'
            )
        }
    })

    it('every file is a family the table sets through CustomFont', () => {
        expect(FontFaces).toHaveLength(fonts.length)
        expect(FontFaces.map(({ family }) => family)).toContain('IM Fell English')
    })
})
