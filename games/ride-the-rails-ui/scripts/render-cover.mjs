/**
 * Renders the catalog cover, src/lib/images/cover.webp, from the SVG drawn below, in the board's
 * flat chart look: a hatched sea in a navy frame, a band of cream hexes with mountain patches, a
 * grey city with its Red and Blue start band, a natural-wood passenger pawn and a $5 pill, a line
 * of flat Red cubes from the west and Blue from the east, and the title in the board's serif on a
 * cream card. Every colour is a palette token from src/app.css: the shared tokens and those of the
 * palette BOARD_LOOK picks (src/lib/utils/boardLook.ts), read from its source; a token the palette
 * does not declare stops the script. The fonts are the ones the table loads: each family named in
 * src/lib/definitions/fonts.ts, with the file GameTable.svelte gives it.
 *
 * Prerequisite: Playwright's Chromium is installed:
 *     cd games/ride-the-rails-ui && pnpm exec playwright install chromium
 *
 * Run:
 *     node games/ride-the-rails-ui/scripts/render-cover.mjs
 */
import { chromium } from '@playwright/test'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const packageRoot = new URL('../', import.meta.url)
const coverFile = fileURLToPath(new URL('src/lib/images/cover.webp', packageRoot))
const source = (path) => readFileSync(new URL(path, packageRoot), 'utf8')

const Width = 544
const Height = 680
const WebpQuality = 0.86

/** The shared tokens and the picked palette's, as one block of declarations. */
function paletteTokens(css, look) {
    const picks = look.slice(look.indexOf('BOARD_LOOK: BoardLook'))
    const palette = /\n\s+palette: '([a-z-]+)',/.exec(picks)
    if (!palette) throw new Error('src/lib/utils/boardLook.ts picks no palette')
    const shared = /^:root \{([^}]*)\}/m.exec(css)
    const own = new RegExp(`^\\[data-rtr-palette='${palette[1]}'\\] \\{([^}]*)\\}`, 'm').exec(css)
    if (!shared || !own) throw new Error(`src/app.css has no ${palette[1]} palette`)
    return shared[1] + own[1]
}

/** Every token the drawing names must be declared, or the cover would draw it black. */
function assertDeclared(drawing, tokens) {
    const declared = new Set([...tokens.matchAll(/(--rtr-[a-z0-9-]+)\s*:/g)].map((m) => m[1]))
    const missing = [
        ...new Set([...drawing.matchAll(/var\((--rtr-[a-z0-9-]+)\)/g)].map((m) => m[1]))
    ].filter((token) => !declared.has(token))
    if (missing.length > 0) throw new Error(`src/app.css declares no ${missing.join(', ')}`)
}

/** A family's name from src/lib/definitions/fonts.ts and the font file GameTable.svelte loads for it. */
function tableFont(constant) {
    const fonts = source('src/lib/definitions/fonts.ts')
    const family = new RegExp(`export const ${constant} = '([^']+)'`).exec(fonts)
    const table = source('src/lib/components/GameTable.svelte')
    const use = new RegExp(`fontFamily=\\{${constant}\\}\\s+url=\\{(\\w+)\\}`).exec(table)
    const file = use && new RegExp(`import ${use[1]} from '\\$lib/fonts/([^']+)'`).exec(table)
    if (!family || !file) throw new Error(`No font file found for ${constant}`)
    return {
        family: family[1],
        bytes: [...readFileSync(new URL(`src/lib/fonts/${file[1]}`, packageRoot))]
    }
}

const serif = tableFont('SerifFontFamily')

// Pointy-topped hexes of size `HexSize`, centre to corner, as the board draws them.
const HexSize = 60
const HexWidth = Math.sqrt(3) * HexSize
const RowHeight = 1.5 * HexSize
const FirstRowY = 300
const CityRow = 2
const CityX = Width / 2
// The board's sizes are for a hex of 40; the cover's hexes are 60.
const Unit = HexSize / 40

function hexCentre(row, column) {
    const shift = (row - CityRow) % 2 === 0 ? 0 : 0.5
    return { x: CityX + (column + shift) * HexWidth, y: FirstRowY + row * RowHeight }
}

function hexCorners({ x, y }, size = HexSize) {
    return Array.from({ length: 6 }, (_, corner) => {
        const angle = (Math.PI / 180) * (60 * corner - 90)
        return { x: x + size * Math.cos(angle), y: y + size * Math.sin(angle) }
    })
}

const points = (corners) => corners.map(({ x, y }) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')

const Mountains = new Set(['0,-3', '1,-3', '3,2', '4,1', '0,2'])

function hexes() {
    const cells = []
    for (let row = 0; row <= 4; row++) {
        for (let column = -4; column <= 3; column++) {
            const centre = hexCentre(row, column)
            if (centre.x < -HexWidth || centre.x > Width + HexWidth) continue
            if (row === CityRow && column === 0) continue
            const mountain = Mountains.has(`${row},${column}`)
            cells.push(
                `<polygon class="${mountain ? 'mountain' : 'plain'}" points="${points(hexCorners(centre))}"/>`
            )
            if (mountain) {
                cells.push(
                    `<path class="peak" transform="translate(${centre.x} ${centre.y - 22.8 * Unit}) scale(${1.1 * Unit})" d="M -9 0 L -3 -8 L 1 -3 L 4 -6 L 9 0 Z"/>`
                )
            }
        }
    }
    return cells.join('\n')
}

// The art plan's start band: just inside the city's edge, the right half Red and the left half
// Blue from the top corner, a pale separator at each split.
function startBand(centre) {
    const inset = HexSize - (6.4 * Unit) / 2
    const corners = hexCorners(centre, inset)
    const right = [corners[0], corners[1], corners[2], corners[3]]
    const left = [corners[3], corners[4], corners[5], corners[0]]
    const half = (side, railroad) =>
        `<polyline class="band band-${railroad}" points="${points(side)}"/>`
    const top = corners[0]
    const bottom = corners[3]
    const outer = hexCorners(centre, HexSize)
    return [
        half(right, 'red'),
        half(left, 'blue'),
        `<line class="band-split" x1="${top.x}" y1="${outer[0].y}" x2="${top.x}" y2="${top.y + 6.4 * Unit}"/>`,
        `<line class="band-split" x1="${bottom.x}" y1="${outer[3].y}" x2="${bottom.x}" y2="${bottom.y - 6.4 * Unit}"/>`
    ].join('\n')
}

// A flat cube as the map draws it: one rounded square in the railroad's colour with a dark edge.
function cube(railroad, { x, y }, side) {
    return `<rect class="cube cube-${railroad}" x="${x - side / 2}" y="${y - side / 2}" width="${side}" height="${side}" rx="${side / 7}"/>`
}

// The art plan's open-hex slots, two cubes side by side.
function trackPair(railroad, centre) {
    const side = 29 * Unit
    return [-16.8, 16.8]
        .map((dx) => cube(railroad, { x: centre.x + dx * Unit, y: centre.y + 2 * Unit }, side))
        .join('\n')
}

const PawnPath =
    'M-1.5 -2.68 A2.6 2.6 0 1 1 1.5 -2.68 L1.5 -2.4 L3 -2.4 L3 -.9 L1.5 -.9 C1.5 1.6 2.7 3.1 3.7 4 L4.5 4 L4.5 6.5 L-4.5 6.5 L-4.5 4 L-3.7 4 C-2.7 3.1 -1.5 1.6 -1.5 -.9 L-3 -.9 L-3 -2.4 L-1.5 -2.4 Z'

const city = hexCentre(CityRow, 0)
const west = [hexCentre(CityRow, -3), hexCentre(CityRow, -2), hexCentre(CityRow, -1)]
const east = [hexCentre(CityRow, 1), hexCentre(CityRow, 2), hexCentre(CityRow, 3)]

const drawing = `<svg xmlns="http://www.w3.org/2000/svg" width="${Width}" height="${Height}" viewBox="0 0 ${Width} ${Height}">
<style>
    .table { fill: var(--rtr-table); }
    .sea { fill: var(--rtr-sea); }
    .sea-line { stroke: var(--rtr-sea-line); stroke-width: 1.5; }
    .frame { fill: none; stroke: var(--rtr-frame); stroke-width: 8; }
    .plain { fill: var(--rtr-plain); stroke: var(--rtr-hex-edge); stroke-width: ${0.9 * Unit}; }
    .mountain { fill: var(--rtr-mountain); stroke: var(--rtr-patch-edge); stroke-width: ${1.4 * Unit}; }
    .peak { fill: var(--rtr-mountain-ink); }
    .city { fill: var(--rtr-hex-start-city); stroke: var(--rtr-patch-edge); stroke-width: ${1.4 * Unit}; }
    .band { fill: none; stroke-width: ${6.4 * Unit}; stroke-linejoin: miter; }
    .band-red { stroke: var(--rtr-railroad-red); }
    .band-blue { stroke: var(--rtr-railroad-blue); }
    .band-split { stroke: var(--rtr-patch-edge); stroke-width: ${1.6 * Unit}; }
    .cube { stroke: var(--rtr-cube-edge); stroke-width: 1.5; }
    .cube-red { fill: var(--rtr-railroad-red); }
    .cube-blue { fill: var(--rtr-railroad-blue); }
    .pawn { fill: var(--rtr-pawn); stroke: var(--rtr-pawn-edge); stroke-width: 0.7; stroke-linejoin: round; }
    .pill { fill: var(--rtr-five); stroke: var(--rtr-ink); stroke-width: ${1.6 * Unit}; }
    .pill-ink { fill: var(--rtr-five-ink); font-family: '${serif.family}'; font-weight: 700; font-size: ${12.8 * Unit}px; text-anchor: middle; }
    .card { fill: var(--rtr-panel); stroke: var(--rtr-card-edge); stroke-width: 2; }
    .rule { stroke: var(--rtr-line); stroke-width: 1.5; }
    .title { font-family: '${serif.family}'; font-weight: 700; text-anchor: middle; fill: var(--rtr-ink); }
    .kicker { font-family: '${serif.family}'; font-weight: 700; text-anchor: middle; fill: var(--rtr-ink-muted); letter-spacing: 8px; }
    .gold { fill: var(--rtr-gold); }
</style>
<defs>
    <pattern id="sea" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect class="sea" width="7" height="7"/>
        <line class="sea-line" x1="0" y1="0" x2="0" y2="7"/>
    </pattern>
</defs>
<rect class="table" width="${Width}" height="${Height}"/>
<rect fill="url(#sea)" x="4" y="4" width="${Width - 8}" height="${Height - 8}" rx="12"/>
${hexes()}
<polygon class="city" points="${points(hexCorners(city))}"/>
${startBand(city)}
${west.map((centre) => trackPair('red', centre)).join('\n')}
${east.map((centre) => trackPair('blue', centre)).join('\n')}
${cube('red', { x: city.x - 15.8 * Unit, y: city.y + 8 * Unit }, 26 * Unit)}
${cube('blue', { x: city.x + 15.8 * Unit, y: city.y + 8 * Unit }, 26 * Unit)}
<path class="pawn" transform="translate(${city.x + 18.4 * Unit} ${city.y - 18.4 * Unit}) scale(${2.1 * Unit})" d="${PawnPath}"/>
<g transform="translate(${city.x - 16.8 * Unit} ${city.y - 20.8 * Unit})">
    <rect class="pill" x="${-13 * Unit}" y="${-8.4 * Unit}" width="${26 * Unit}" height="${16.8 * Unit}" rx="${8.4 * Unit}"/>
    <text class="pill-ink" y="${4.5 * Unit}">$5</text>
</g>
<rect class="frame" x="4" y="4" width="${Width - 8}" height="${Height - 8}" rx="12"/>
<rect class="card" x="40" y="40" width="${Width - 80}" height="170" rx="10"/>
<text class="kicker" x="${Width / 2}" y="92" font-size="34">RIDE THE</text>
<line class="rule" x1="96" y1="110" x2="${Width - 96}" y2="110"/>
<text class="title" x="${Width / 2}" y="186" font-size="88">Rails</text>
<circle class="gold" cx="96" cy="158" r="6"/>
<circle class="gold" cx="${Width - 96}" cy="158" r="6"/>
</svg>`

const tokens = paletteTokens(source('src/app.css'), source('src/lib/utils/boardLook.ts'))
assertDeclared(drawing, tokens)

const page = `<!doctype html><html><head><style>
    :root {${tokens}}
    body { margin: 0; }
    svg { display: block; }
</style></head><body>${drawing}</body></html>`

const browser = await chromium.launch()
try {
    const tab = await browser.newPage({ viewport: { width: Width, height: Height } })
    await tab.setContent(page)
    await tab.evaluate(async ({ family, bytes }) => {
        const face = new FontFace(family, new Uint8Array(bytes), { weight: '700' })
        document.fonts.add(await face.load())
        await document.fonts.ready
    }, serif)
    const png = await tab.screenshot({ clip: { x: 0, y: 0, width: Width, height: Height } })
    const webp = await tab.evaluate(
        async ({ bytes, quality, width, height }) => {
            const bitmap = await createImageBitmap(
                new Blob([new Uint8Array(bytes)], { type: 'image/png' })
            )
            const canvas = new OffscreenCanvas(width, height)
            canvas.getContext('2d').drawImage(bitmap, 0, 0)
            const blob = await canvas.convertToBlob({ type: 'image/webp', quality })
            return [...new Uint8Array(await blob.arrayBuffer())]
        },
        { bytes: [...png], quality: WebpQuality, width: Width, height: Height }
    )
    writeFileSync(coverFile, Uint8Array.from(webp))
    console.log(`Wrote ${coverFile} (${webp.length} bytes)`)
} finally {
    await browser.close()
}
