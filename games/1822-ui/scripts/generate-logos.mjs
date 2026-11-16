// Writes each company's station token to ../src/lib/images/logos. A major company's is its
// initials on a disc of its charter colour; a minor company's is its number on a pale disc with a
// dark rim, as the minors' tokens are numbered (§3.3.1, §3.4.1). Run after building
// @tabletop/1822: node scripts/generate-logos.mjs. It also writes ../src/lib/logos.ts, which names
// each token's file for the map view.
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Majors1822, Minors1822 } from '@tabletop/1822'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'lib', 'images', 'logos')
const Outline = '#1f1f1f'
const DarkInk = '#1f1f1f'
const LightInk = '#fffefa'
const MinorFill = '#f3ead6'
const BaselineShift = 0.35
const Serif = `Georgia, 'Times New Roman', Times, serif`
// Georgia's figures are old-style, its 1 no taller than a small letter, so a number set in it sits
// low in the token's ring; Times' figures stand at the height of its capitals.
const FigureSerif = `'Times New Roman', Times, serif`
// Half the height of Times' figures, which are a little shorter than Georgia's capitals.
const FigureBaselineShift = 0.33

function luminance(hex) {
    const channel = (offset) => {
        const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255
        return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
    }
    return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5)
}
const contrast = (first, second) => {
    const [light, dark] = [luminance(first), luminance(second)].sort((a, b) => b - a)
    return (light + 0.05) / (dark + 0.05)
}
const ink = (fill) => (contrast(fill, LightInk) >= contrast(fill, DarkInk) ? LightInk : DarkInk)
const escape = (text) => text.replaceAll('&', '&amp;')

function label(text, size, fill, family = Serif, shift = BaselineShift) {
    return (
        `<text x="20" y="${(20 + shift * size).toFixed(2)}" text-anchor="middle" ` +
        `font-family="${family}" font-weight="bold" font-size="${size.toFixed(2)}" ` +
        `fill="${fill}">${escape(text)}</text>`
    )
}

function majorToken(initials, color) {
    const fontSize = Math.min(13, (2 * 19.4 * 0.86) / (0.62 * initials.length))
    return (
        `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">` +
        `<circle cx="20" cy="20" r="19.4" fill="${color}" stroke="${Outline}" stroke-width="0.8"/>` +
        label(initials, fontSize, ink(color)) +
        `</svg>\n`
    )
}

function minorToken(number) {
    return (
        `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">` +
        `<circle cx="20" cy="20" r="19.4" fill="${MinorFill}" stroke="${Outline}" stroke-width="0.8"/>` +
        `<circle cx="20" cy="20" r="15.6" fill="none" stroke="${Outline}" stroke-width="1.6"/>` +
        label(number, number.length > 1 ? 15 : 17, DarkInk, FigureSerif, FigureBaselineShift) +
        `</svg>\n`
    )
}

mkdirSync(OUT, { recursive: true })
for (const major of Majors1822)
    writeFileSync(join(OUT, `${major.id}.svg`), majorToken(major.initials, major.color))
for (const minor of Minors1822)
    writeFileSync(join(OUT, `${minor.id}.svg`), minorToken(minor.id.slice(1)))

const ids = [...Majors1822, ...Minors1822].map((company) => company.id)
writeFileSync(
    join(OUT, '..', '..', 'logos.ts'),
    `// Written by scripts/generate-logos.mjs.\n` +
        ids.map((id) => `import ${id} from './images/logos/${id}.svg'\n`).join('') +
        `\n/** Each company's station token, by company id. */\n` +
        `export const Logos1822: Readonly<Record<string, string>> = {\n` +
        ids.map((id) => `    ${id}`).join(',\n') +
        `\n}\n`
)
