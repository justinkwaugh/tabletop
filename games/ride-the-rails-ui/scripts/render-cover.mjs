/**
 * Renders the catalog cover, src/lib/images/cover.webp, from the SVG drawn below: a band of map
 * hexes, a Red and a Blue wooden cube meeting at a station ringed in its start colours, a
 * passenger waiting, a $5 coin, and the title in the title's display font. Every colour is a
 * palette token from src/app.css: the shared tokens and those of the palette BOARD_LOOK picks
 * (src/lib/utils/boardLook.ts), read from its source.
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
const fontFile = fileURLToPath(new URL('src/lib/fonts/BigShouldersDisplay-Bold.woff2', packageRoot))
const appCss = readFileSync(new URL('src/app.css', packageRoot), 'utf8')

const Width = 544
const Height = 680
const WebpQuality = 0.86
const FontFamily = 'Ride the Rails Display'

const boardLook = readFileSync(new URL('src/lib/utils/boardLook.ts', packageRoot), 'utf8')

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

// Pointy-topped hexes of size `HexSize`, centre to corner, as the board draws them.
const HexSize = 60
const HexWidth = Math.sqrt(3) * HexSize
const RowHeight = 1.5 * HexSize
const FirstRowY = 250
const CityRow = 3
const CityX = Width / 2

function hexCentre(row, column) {
    const shift = (row - CityRow) % 2 === 0 ? 0 : 0.5
    return { x: CityX + (column + shift) * HexWidth, y: FirstRowY + row * RowHeight }
}

function hexPoints({ x, y }, size = HexSize) {
    return Array.from({ length: 6 }, (_, corner) => {
        const angle = (Math.PI / 180) * (60 * corner - 90)
        const px = x + size * Math.cos(angle)
        const py = y + size * Math.sin(angle)
        return `${px.toFixed(1)},${py.toFixed(1)}`
    }).join(' ')
}

const Mountains = new Set(['1,1', '2,-2', '4,2', '5,-1', '2,2'])

function hexes() {
    const cells = []
    for (let row = 0; row <= 5; row++) {
        for (let column = -4; column <= 3; column++) {
            const centre = hexCentre(row, column)
            if (centre.x < -HexWidth || centre.x > Width + HexWidth) continue
            const mountain = Mountains.has(`${row},${column}`)
            cells.push(
                `<polygon class="${mountain ? 'mountain' : 'plain'}" points="${hexPoints(centre)}"/>`
            )
            if (mountain) cells.push(`<use href="#peaks" x="${centre.x}" y="${centre.y}"/>`)
        }
    }
    return cells.join('\n')
}

function routeLine(className, points) {
    const path = points.map(({ x, y }) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
    return `<polyline class="halo-line" points="${path}"/><polyline class="${className}" points="${path}"/>`
}

// A wooden cube as the board draws it (src/lib/utils/cubeShape.ts, 10 units across), centred on
// (x, y) and `width` across: the railroad's colour, its sides shaded by gradients, grain strokes,
// a worn edge and its letter on top.
function cube(railroad, letter, x, y, width) {
    const top = -2.8
    const n = `0,${top - 2.5}`
    const e = `5,${top}`
    const s = `0,${top + 2.5}`
    const w = `-5,${top}`
    const eLow = `5,${top + 5.6}`
    const sLow = `0,${top + 8.1}`
    const wLow = `-5,${top + 5.6}`
    return `<g transform="translate(${x} ${y}) scale(${width / 10})">
        <polygon class="cube-${railroad} cube-edge" points="${n} ${e} ${eLow} ${sLow} ${wLow} ${w}"/>
        <polygon fill="url(#cube-left)" points="${w} ${s} ${sLow} ${wLow}"/>
        <polygon fill="url(#cube-right)" points="${s} ${e} ${eLow} ${sLow}"/>
        <polygon fill="url(#cube-top)" points="${n} ${e} ${s} ${w}"/>
        <path class="grain" d="M-3.1 -3.4 Q-1 -3.7 0.9 -2.3 T3.4 -1.9 M-2.2 -2.1 Q-0.4 -2.6 1.5 -1.2 M-4.4 -0.9 Q-2.6 -0.3 -0.5 1.2 M-4.4 1 Q-2.4 2.1 -0.6 3.3 M0.6 1.8 Q2.4 0.4 4.4 -0.2 M0.6 3.9 Q2.8 2.6 4.4 2.1"/>
        <path class="worn" d="M-4.6 ${top + 0.2} L0 ${top + 2.5} L4.6 ${top + 0.2}"/>
        <text class="letter ink-${railroad}" y="${top + 4.2 * 0.35}">${letter}</text>
    </g>`
}

// The station's start ring: one arc per railroad that may start there, on a white ring.
function startRing({ x, y }, railroads) {
    const radius = 52
    const gap = 0.3
    const span = (2 * Math.PI) / railroads.length
    const point = (angle) =>
        `${(x + radius * Math.cos(angle)).toFixed(1)} ${(y + radius * Math.sin(angle)).toFixed(1)}`
    const arcs = railroads.map((railroad, index) => {
        const from = -Math.PI / 2 - span / 2 + index * span + gap / 2
        const to = from + span - gap
        return `<path class="ring-${railroad}" d="M${point(from)} A${radius} ${radius} 0 0 1 ${point(to)}"/>`
    })
    return `<circle class="ring-outline" cx="${x}" cy="${y}" r="${radius}"/>
<circle class="ring-ground" cx="${x}" cy="${y}" r="${radius}"/>
${arcs.join('\n')}`
}

const city = hexCentre(CityRow, 0)
const west = [hexCentre(CityRow, -4), hexCentre(CityRow, -3), hexCentre(CityRow, -2), city]
const east = [city, hexCentre(CityRow, 1), hexCentre(CityRow, 2), hexCentre(CityRow, 3)]
const south = [city, hexCentre(4, 0), hexCentre(5, 0), hexCentre(5, 1)]
const north = [hexCentre(0, -1), hexCentre(1, -1), hexCentre(2, -1), city]

const coverSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${Width}" height="${Height}" viewBox="0 0 ${Width} ${Height}">
<style>
    .sea { fill: var(--rtr-sea); }
    .plain { fill: var(--rtr-plain); stroke: var(--rtr-hex-edge); stroke-width: 3; }
    .mountain { fill: var(--rtr-mountain); stroke: var(--rtr-hex-edge); stroke-width: 3; }
    .city-hex { fill: var(--rtr-hex-east); stroke: var(--rtr-hex-edge); stroke-width: 3; }
    .city-rim { fill: none; stroke: var(--rtr-hex-east-rim); stroke-width: 5; }
    .peaks { fill: var(--rtr-mountain-ink); fill-opacity: 0.6; }
    .halo-line { fill: none; stroke: var(--rtr-halo); stroke-width: 16; stroke-linejoin: round; stroke-linecap: round; }
    .route-red, .route-blue, .route-yellow, .route-purple { fill: none; stroke-width: 8; stroke-linejoin: round; stroke-linecap: round; }
    .route-red { stroke: var(--rtr-railroad-red); }
    .route-blue { stroke: var(--rtr-railroad-blue); }
    .route-yellow { stroke: var(--rtr-railroad-yellow); }
    .route-purple { stroke: var(--rtr-railroad-purple); }
    .ring-outline { fill: none; stroke: var(--rtr-station-ink); stroke-width: 30; }
    .ring-ground { fill: none; stroke: var(--rtr-station); stroke-width: 23; }
    .ring-red, .ring-blue, .ring-orange, .ring-yellow { fill: none; stroke-width: 19; }
    .ring-red { stroke: var(--rtr-railroad-red); }
    .ring-blue { stroke: var(--rtr-railroad-blue); }
    .ring-orange { stroke: var(--rtr-railroad-orange); }
    .ring-yellow { stroke: var(--rtr-railroad-yellow); }
    .station { fill: var(--rtr-station); stroke: var(--rtr-station-ink); stroke-width: 5; }
    .station-ink { fill: var(--rtr-station-ink); }
    .cube-edge { stroke: var(--rtr-cube-edge); stroke-width: 0.8; stroke-linejoin: round; }
    .cube-red { fill: var(--rtr-railroad-red); }
    .cube-blue { fill: var(--rtr-railroad-blue); }
    .grain { fill: none; stroke: var(--rtr-cube-shade); stroke-opacity: 0.3; stroke-width: 0.32; stroke-linecap: round; }
    .worn { fill: none; stroke: var(--rtr-cube-sheen); stroke-opacity: 0.45; stroke-width: 0.42; stroke-linecap: round; stroke-linejoin: round; }
    .letter { font-family: Arial, sans-serif; font-weight: 800; font-size: 4.2px; text-anchor: middle; }
    .ink-red { fill: var(--rtr-railroad-red-ink); }
    .ink-blue { fill: var(--rtr-railroad-blue-ink); }
    .passenger { fill: var(--rtr-passenger); stroke: var(--rtr-station); stroke-width: 4; paint-order: stroke; stroke-linejoin: round; }
    .coin-shadow { fill: var(--rtr-halo); fill-opacity: 0.18; }
    .coin { fill: var(--rtr-five); stroke: var(--rtr-five-rim); stroke-width: 4; }
    .coin-ring { fill: none; stroke: var(--rtr-station); stroke-opacity: 0.5; stroke-width: 2; }
    .coin-ink { fill: var(--rtr-five-ink); font-family: Arial, sans-serif; font-weight: 900; font-size: 30px; text-anchor: middle; letter-spacing: -1px; }
    .title { font-family: '${FontFamily}'; text-anchor: middle; letter-spacing: 2px; }
    .title-ink { fill: var(--rtr-ink); }
    .title-gold { fill: var(--rtr-gold); }
    .title-shadow { fill: var(--rtr-ink); }
    .title-halo { fill: none; stroke: var(--rtr-station); stroke-width: 10; stroke-linejoin: round; }
</style>
<defs>
    <g id="peaks"><path class="peaks" d="M-27,13.5 L-10.2,-13.8 L1.8,4.2 L10.8,-6.6 L27,13.5 Z"/></g>
    <linearGradient id="cube-top" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="var(--rtr-cube-sheen)" stop-opacity="0.34"/>
        <stop offset="0.6" stop-color="var(--rtr-cube-sheen)" stop-opacity="0"/>
        <stop offset="1" stop-color="var(--rtr-cube-shade)" stop-opacity="0.08"/>
    </linearGradient>
    <linearGradient id="cube-left" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="var(--rtr-cube-shade)" stop-opacity="0.12"/>
        <stop offset="1" stop-color="var(--rtr-cube-shade)" stop-opacity="0.36"/>
    </linearGradient>
    <linearGradient id="cube-right" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="var(--rtr-cube-shade)" stop-opacity="0.34"/>
        <stop offset="1" stop-color="var(--rtr-cube-shade)" stop-opacity="0.54"/>
    </linearGradient>
</defs>
<rect class="sea" width="${Width}" height="${Height}"/>
${hexes()}
<polygon class="city-hex" points="${hexPoints(city)}"/>
<polygon class="city-rim" points="${hexPoints(city, HexSize - 4)}"/>
${routeLine('route-purple', north)}
${routeLine('route-yellow', south)}
${routeLine('route-red', west)}
${routeLine('route-blue', east)}
${startRing(city, ['red', 'blue', 'orange', 'yellow'])}
<circle class="station" cx="${city.x}" cy="${city.y}" r="34"/>
<path class="station-ink" d="M${city.x - 20},${city.y - 2} L${city.x},${city.y - 20} L${city.x + 20},${city.y - 2} L${city.x + 15},${city.y - 2} L${city.x + 15},${city.y + 16} L${city.x - 15},${city.y + 16} L${city.x - 15},${city.y - 2} z"/>
<rect class="station" x="${city.x - 6}" y="${city.y + 3}" width="12" height="13" style="stroke-width: 0"/>
<g transform="translate(${city.x + 84} ${city.y - 40})">
    <circle class="passenger" cx="0" cy="-26" r="15"/>
    <path class="passenger" d="M-23,29 L-20,-3 Q0,-14 20,-3 L23,29 z"/>
</g>
<g transform="translate(${city.x - 88} ${city.y - 66})">
    <circle class="coin-shadow" cy="3" r="27"/>
    <circle class="coin" r="27"/>
    <circle class="coin-ring" r="20"/>
    <text class="coin-ink" y="${30 * 0.35}">$5</text>
</g>
${cube('red', 'R', city.x - 150, city.y + 6, 92)}
${cube('blue', 'B', city.x + 150, city.y + 6, 92)}
<text class="title title-halo" x="${Width / 2}" y="100" font-size="104">RIDE THE</text>
<text class="title title-ink" x="${Width / 2}" y="100" font-size="104">RIDE THE</text>
<text class="title title-shadow" x="${Width / 2 + 5}" y="230" font-size="150">RAILS</text>
<text class="title title-gold" x="${Width / 2}" y="225" font-size="150">RAILS</text>
</svg>`

const page = `<!doctype html><html><head><style>
    :root {${paletteTokens(appCss, boardLook)}}
    body { margin: 0; }
    svg { display: block; }
</style></head><body>${coverSvg}</body></html>`

const browser = await chromium.launch()
try {
    const tab = await browser.newPage({ viewport: { width: Width, height: Height } })
    await tab.setContent(page)
    await tab.evaluate(
        async ({ family, bytes }) => {
            const face = new FontFace(family, new Uint8Array(bytes), { weight: '700' })
            document.fonts.add(await face.load())
            await document.fonts.ready
        },
        { family: FontFamily, bytes: [...readFileSync(fontFile)] }
    )
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
