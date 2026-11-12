// Writes each corporation's station token to ../src/lib/images/logos: its initials on a disc of
// its charter colour (§7.2). Run: node scripts/generate-logos.mjs
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'lib', 'images', 'logos')
const Colors = {
    AFG: '#d6242c',
    ATA: '#2f8a3e',
    CTL: '#f2b230',
    IFT: '#1b86c8',
    RCS: '#ee7f22',
    SFA: '#e99bbd'
}
const Outline = '#1f1f1f'
const DarkInk = '#1f1f1f'
const LightInk = '#fffefa'
const BaselineShift = 0.35

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

function token(initials, color) {
    const fontSize = Math.min(13, (2 * 19.4 * 0.86) / (0.62 * initials.length))
    return (
        `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">` +
        `<circle cx="20" cy="20" r="19.4" fill="${color}" stroke="${Outline}" stroke-width="0.8"/>` +
        `<text x="20" y="${(20 + BaselineShift * fontSize).toFixed(2)}" text-anchor="middle" ` +
        `font-family="Georgia, 'Times New Roman', Times, serif" font-weight="bold" ` +
        `font-size="${fontSize.toFixed(2)}" fill="${ink(color)}">${initials}</text>` +
        `</svg>\n`
    )
}

mkdirSync(OUT, { recursive: true })
for (const [id, color] of Object.entries(Colors))
    writeFileSync(join(OUT, `${id}.svg`), token(id, color))
