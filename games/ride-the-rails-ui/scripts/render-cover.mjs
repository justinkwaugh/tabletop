/**
 * Renders the catalog cover, src/lib/images/cover.webp, from the SVG drawn below: a band of map
 * hexes, a Red and a Blue locomotive meeting at a station, a passenger waiting, and the title in
 * the title's display font. Every colour is a palette token from src/app.css, in its dark values,
 * which are the site's.
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

function darkTokens(css) {
    const block = /@scope \(\.dark\) \{\s*:root \{([^}]*)\}/.exec(css)
    if (!block) throw new Error('src/app.css has no dark palette block')
    return block[1]
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

function hexPoints({ x, y }) {
    return Array.from({ length: 6 }, (_, corner) => {
        const angle = (Math.PI / 180) * (60 * corner - 90)
        const px = x + HexSize * Math.cos(angle)
        const py = y + HexSize * Math.sin(angle)
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

// A side-view locomotive facing right, its rails at y = 0: cab, boiler, dome, chimney,
// cow-catcher and two wheels, with the railroad's monogram on the cab.
function locomotive(railroad, monogram, x, facing) {
    const fill = `loco-${railroad}`
    const ink = `ink-${railroad}`
    const mirror = facing === 'left' ? ' scale(-1 1)' : ''
    const text = facing === 'left' ? ' transform="scale(-1 1)"' : ''
    const textX = facing === 'left' ? 41 : -41
    return `<g transform="translate(${x} ${railY})${mirror}">
        <rect class="edge ${fill}" x="-62" y="-30" width="114" height="12" rx="2"/>
        <polygon class="edge ${fill}" points="52,-30 70,-4 52,-4"/>
        <rect class="edge ${fill}" x="-26" y="-62" width="72" height="34" rx="15"/>
        <path class="edge ${fill}" d="M-6,-62 a10,10 0 0 1 20,0 z"/>
        <path class="edge ${fill}" d="M24,-62 L22,-78 L18,-84 L42,-84 L38,-78 L36,-62 z"/>
        <rect class="edge ${fill}" x="-60" y="-82" width="40" height="54" rx="3"/>
        <rect class="edge ${fill}" x="-66" y="-90" width="52" height="10" rx="3"/>
        <rect class="window" x="-54" y="-74" width="28" height="14" rx="2"/>
        <text class="monogram ${ink}" x="${textX}" y="-34"${text}>${monogram}</text>
        <circle class="wheel" cx="-36" cy="-17" r="17"/>
        <circle class="hub ${fill}" cx="-36" cy="-17" r="6"/>
        <circle class="wheel" cx="28" cy="-13" r="13"/>
        <circle class="hub ${fill}" cx="28" cy="-13" r="5"/>
    </g>`
}

const city = hexCentre(CityRow, 0)
const railY = city.y - 4
const west = [hexCentre(CityRow, -4), hexCentre(CityRow, -3), hexCentre(CityRow, -2), city]
const east = [city, hexCentre(CityRow, 1), hexCentre(CityRow, 2), hexCentre(CityRow, 3)]
const south = [city, hexCentre(4, 0), hexCentre(5, 0), hexCentre(5, 1)]
const north = [hexCentre(0, -1), hexCentre(1, -1), hexCentre(2, -1), city]

const coverSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${Width}" height="${Height}" viewBox="0 0 ${Width} ${Height}">
<style>
    .sea { fill: var(--rtr-sea); }
    .plain { fill: var(--rtr-plain); stroke: var(--rtr-hex-edge); stroke-width: 3; }
    .mountain { fill: var(--rtr-mountain); stroke: var(--rtr-hex-edge); stroke-width: 3; }
    .peaks { fill: none; stroke: var(--rtr-mountain-ink); stroke-width: 5; stroke-linejoin: round; stroke-linecap: round; }
    .halo-line { fill: none; stroke: var(--rtr-halo); stroke-width: 16; stroke-linejoin: round; stroke-linecap: round; }
    .route-red, .route-blue, .route-yellow, .route-purple { fill: none; stroke-width: 8; stroke-linejoin: round; stroke-linecap: round; }
    .route-red { stroke: var(--rtr-railroad-red); }
    .route-blue { stroke: var(--rtr-railroad-blue); }
    .route-yellow { stroke: var(--rtr-railroad-yellow); }
    .route-purple { stroke: var(--rtr-railroad-purple); }
    .station { fill: var(--rtr-station); stroke: var(--rtr-halo); stroke-width: 4; }
    .station-ink { fill: var(--rtr-station-ink); }
    .edge { stroke: var(--rtr-halo); stroke-width: 3; stroke-linejoin: round; }
    .loco-red { fill: var(--rtr-railroad-red); }
    .loco-blue { fill: var(--rtr-railroad-blue); }
    .ink-red { fill: var(--rtr-railroad-red-ink); }
    .ink-blue { fill: var(--rtr-railroad-blue-ink); }
    .window { fill: var(--rtr-halo); opacity: 0.55; }
    .wheel { fill: var(--rtr-halo); stroke: var(--rtr-station); stroke-width: 2; }
    .monogram { font-family: '${FontFamily}'; font-size: 34px; text-anchor: middle; }
    .passenger { fill: var(--rtr-ink); stroke: var(--rtr-station); stroke-width: 3; }
    .title { font-family: '${FontFamily}'; text-anchor: middle; letter-spacing: 2px; }
    .title-ink { fill: var(--rtr-ink); }
    .title-gold { fill: var(--rtr-gold); }
    .title-shadow { fill: var(--rtr-halo); }
    .rule { stroke: var(--rtr-gold); stroke-width: 4; }
    .tie { fill: var(--rtr-gold); stroke: var(--rtr-halo); stroke-width: 2; }
</style>
<defs>
    <g id="peaks"><path class="peaks" d="M-26,14 L-10,-10 L0,4 L12,-16 L28,14"/></g>
</defs>
<rect class="sea" width="${Width}" height="${Height}"/>
${hexes()}
${routeLine('route-purple', north)}
${routeLine('route-yellow', south)}
${routeLine('route-red', west)}
${routeLine('route-blue', east)}
<rect class="tie" x="${city.x - 30}" y="${city.y + 30}" width="60" height="10" rx="2"/>
<circle class="station" cx="${city.x}" cy="${city.y}" r="34"/>
<path class="station-ink" d="M${city.x - 20},${city.y - 2} L${city.x},${city.y - 20} L${city.x + 20},${city.y - 2} L${city.x + 15},${city.y - 2} L${city.x + 15},${city.y + 16} L${city.x - 15},${city.y + 16} L${city.x - 15},${city.y - 2} z"/>
<rect class="station" x="${city.x - 6}" y="${city.y + 3}" width="12" height="13" style="stroke-width: 0"/>
<g transform="translate(${city.x + 34} ${city.y - 46})">
    <circle class="passenger" cx="0" cy="-22" r="9"/>
    <path class="passenger" d="M-11,14 L-11,-4 a11,11 0 0 1 22,0 L11,14 z"/>
</g>
${locomotive('red', 'R', city.x - 128, 'right')}
${locomotive('blue', 'B', city.x + 128, 'left')}
<text class="title title-shadow" x="${Width / 2 + 4}" y="104" font-size="104">RIDE THE</text>
<text class="title title-ink" x="${Width / 2}" y="100" font-size="104">RIDE THE</text>
<text class="title title-shadow" x="${Width / 2 + 5}" y="230" font-size="150">RAILS</text>
<text class="title title-gold" x="${Width / 2}" y="225" font-size="150">RAILS</text>
</svg>`

const page = `<!doctype html><html><head><style>
    :root {${darkTokens(appCss)}}
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
