// Writes each company's station token to ../src/lib/images/logos: its initials on a disc of its
// primary colour, ringed in its secondary colour where the company has one (§2.1).
// Build the logic package first: node scripts/generate-logos.mjs
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Companies1862 } from '@tabletop/1862'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'lib', 'images', 'logos')
const Outline = '#1f1f1f'
const DarkInk = '#1f1f1f'
const LightInk = '#fffefa'
// Initials sit on the alphabetic baseline, shifted down by the share of the size that centres
// capitals, as the 18xx board text does.
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

function token({ initials, primaryColor, secondaryColor }) {
    const face = secondaryColor ? 14.5 : 19.4
    const fontSize = Math.min(13, (2 * face * 0.86) / (0.62 * initials.length))
    const escaped = initials.replaceAll('&', '&amp;')
    const ring = secondaryColor
        ? `<circle cx="20" cy="20" r="19.4" fill="${secondaryColor}"/>` +
          `<circle cx="20" cy="20" r="${face}" fill="${primaryColor}" stroke="${Outline}" stroke-width="0.6"/>`
        : `<circle cx="20" cy="20" r="${face}" fill="${primaryColor}"/>`
    return (
        `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">` +
        ring +
        `<circle cx="20" cy="20" r="19.4" fill="none" stroke="${Outline}" stroke-width="0.8"/>` +
        `<text x="20" y="${(20 + BaselineShift * fontSize).toFixed(2)}" text-anchor="middle" ` +
        `font-family="Georgia, 'Times New Roman', Times, serif" font-weight="bold" ` +
        `font-size="${fontSize.toFixed(2)}" fill="${ink(primaryColor)}">${escaped}</text>` +
        `</svg>\n`
    )
}

mkdirSync(OUT, { recursive: true })
for (const company of Companies1862) writeFileSync(join(OUT, `${company.id}.svg`), token(company))
