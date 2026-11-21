// Writes each corporation's station token to ../src/lib/images/logos, its abbreviation on a disc
// of its charter colour in the charter's ink, and ../src/lib/logos.ts, which imports them.
// Build @tabletop/18usa first, then run: node scripts/generate-logos.mjs
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { EighteenUSACorporations } from '@tabletop/18usa'

const LIB = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'lib')
const OUT = join(LIB, 'images', 'logos')
const Outline = '#1f1f1f'
const BaselineShift = 0.35
const escape = (text) => text.replace(/&/g, '&amp;')

function token({ abbreviation, color, textColor }) {
    const fontSize = Math.min(13, (2 * 19.4 * 0.86) / (0.62 * abbreviation.length))
    return (
        `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">` +
        `<circle cx="20" cy="20" r="19.4" fill="${color}" stroke="${Outline}" stroke-width="0.8"/>` +
        `<text x="20" y="${(20 + BaselineShift * fontSize).toFixed(2)}" text-anchor="middle" ` +
        `font-family="Georgia, 'Times New Roman', Times, serif" font-weight="bold" ` +
        `font-size="${fontSize.toFixed(2)}" fill="${textColor}">${escape(abbreviation)}</text>` +
        `</svg>\n`
    )
}

mkdirSync(OUT, { recursive: true })
for (const corporation of EighteenUSACorporations)
    writeFileSync(join(OUT, `${corporation.id}.svg`), token(corporation))

const ids = EighteenUSACorporations.map((corporation) => corporation.id)
writeFileSync(
    join(LIB, 'logos.ts'),
    '// Written by scripts/generate-logos.mjs.\n' +
        ids.map((id) => `import ${id}Logo from './images/logos/${id}.svg'\n`).join('') +
        '\nexport const EighteenUSALogos: Readonly<Record<string, string>> = {\n' +
        ids.map((id) => `    ${id}: ${id}Logo`).join(',\n') +
        '\n}\n'
)
