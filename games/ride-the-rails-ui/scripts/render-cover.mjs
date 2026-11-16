/**
 * Renders the catalog cover, src/lib/images/cover.webp, in the style of John Bohrer's other titles
 * here (Preußische Ostbahn, South African Railroads): a cream title band with the name in a bold
 * serif and a line under it, a navy rule, and below it the board itself.
 *
 * The board is the table's own: the script loads a position into the running dev harness, with
 * railroads built out of Chicago and the East, and photographs that part of the map. The position
 * is first-share.json with its track replaced by the lines below, written to src/scenarios for the
 * run and removed after it. The title is set in the board's serif, the family
 * src/lib/definitions/fonts.ts names, from the file the table loads.
 *
 * Prerequisites: Playwright's Chromium is installed (pnpm exec playwright install chromium), the
 * logic package is built, and the harness is running:
 *     cd games/ride-the-rails-ui && pnpm dev
 *
 * Run, from the repository root:
 *     node games/ride-the-rails-ui/scripts/render-cover.mjs
 */
import { chromium } from '@playwright/test'
import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const packageRoot = new URL('../', import.meta.url)
const coverFile = fileURLToPath(new URL('src/lib/images/cover.webp', packageRoot))
const scenarioFile = fileURLToPath(new URL('src/scenarios/cover.json', packageRoot))
const source = (path) => readFileSync(new URL(path, packageRoot), 'utf8')
const { USA_CITIES, USA_HEXES, adjacentHexIds } = await import(
    new URL('../../ride-the-rails/esm/index.js', import.meta.url)
)

const Harness = 'http://localhost:4218/'
const ScenarioName = 'Cover'
const Width = 482
const Height = 680
const BandHeight = 196
const RuleHeight = 4
const WebpQuality = 0.86
// The other covers' paper, ink and rule.
const Paper = '#F2E8D4'
const Ink = '#2D2714'
const MutedInk = '#6F6450'
const Rule = '#1F3B5D'

// The map seen in the board's fitted view, in CSS pixels of a 1600 × 1000 window, square, from
// Minneapolis and Saint Louis east to the Atlantic.
const MapClip = { x: 940, y: 330, width: 500, height: 500 }
const PhotoScale = 4

// Railroads built out from their starts: each a run of city-to-city links, the shortest way.
const Lines = {
    'railroad.red': ['New York', 'Pittsburgh', 'Chicago', 'Minneapolis'],
    'railroad.blue': ['Baltimore', 'Cincinnati', 'Saint Louis', 'Kansas City'],
    'railroad.orange': ['Saint Louis', 'Chicago', 'Detroit', 'Buffalo', 'Albany'],
    'railroad.yellow': ['Milwaukee', 'Chicago', 'Des Moines', 'Omaha'],
    'railroad.black': ['Atlanta', 'Nashville', 'Saint Louis'],
    'railroad.purple': ['Denver', 'Kansas City']
}

function cityHex(name) {
    const city = USA_CITIES.find((candidate) => candidate.name === name)
    if (!city) throw new Error(`No city ${name}`)
    return city.hexId
}

const land = new Set(USA_HEXES.map((hex) => hex.id))
function shortestWay(from, to) {
    const previous = new Map([[from, undefined]])
    const queue = [from]
    while (queue.length > 0) {
        const hexId = queue.shift()
        if (hexId === to) break
        for (const next of adjacentHexIds(hexId)) {
            if (land.has(next) && !previous.has(next)) {
                previous.set(next, hexId)
                queue.push(next)
            }
        }
    }
    const way = []
    for (let hexId = to; hexId; hexId = previous.get(hexId)) way.unshift(hexId)
    return way
}

function coverTrack() {
    const chicago = cityHex('Chicago')
    const track = {}
    for (const [railroadId, cities] of Object.entries(Lines)) {
        for (let index = 1; index < cities.length; index++) {
            for (const hexId of shortestWay(cityHex(cities[index - 1]), cityHex(cities[index]))) {
                const held = (track[hexId] ??= [])
                const room = hexId === chicago ? 6 : 2
                if (!held.includes(railroadId) && held.length < room) held.push(railroadId)
            }
        }
    }
    return track
}

/** first-share.json with the cover's track, named so the Scenarios menu lists it. */
function coverScenario() {
    const scenario = JSON.parse(source('src/scenarios/first-share.json'))
    scenario.state.track = coverTrack()
    const rename = (node) => {
        if (Array.isArray(node)) node.forEach(rename)
        else if (node && typeof node === 'object') {
            for (const [key, value] of Object.entries(node)) {
                if (key === 'name' && value === 'First share') node[key] = ScenarioName
                else rename(value)
            }
        }
    }
    rename(scenario)
    return scenario
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

async function photographMap(browser) {
    const tab = await browser.newPage({
        viewport: { width: 1600, height: 1000 },
        deviceScaleFactor: PhotoScale
    })
    await tab.goto(Harness)
    await tab.getByRole('button', { name: 'Scenarios' }).click()
    await tab.getByRole('button', { name: ScenarioName, exact: true }).click()
    await tab.waitForTimeout(1500)
    await tab.mouse.move(0, 0)
    const png = await tab.screenshot({ clip: MapClip })
    await tab.close()
    return png
}

const serif = tableFont('SerifFontFamily')
const mapHeight = Height - BandHeight - RuleHeight

writeFileSync(scenarioFile, JSON.stringify(coverScenario(), null, 4))
const browser = await chromium.launch()
try {
    // The harness picks up the new scenario file.
    await new Promise((resolve) => setTimeout(resolve, 1500))
    const map = await photographMap(browser)
    const page = `<!doctype html><html><head><style>
        body { margin: 0; width: ${Width}px; height: ${Height}px; overflow: hidden; background: ${Paper}; }
        .band { height: ${BandHeight}px; display: flex; flex-direction: column; align-items: center;
            justify-content: center; text-align: center; color: ${Ink}; }
        .title { font-family: '${serif.family}'; font-weight: 700; font-size: 54px; line-height: 1.04; }
        .subtitle { margin-top: 14px; font-family: '${serif.family}'; font-size: 17px; color: ${MutedInk}; }
        .rule { height: ${RuleHeight}px; background: ${Rule}; }
        .map { width: ${Width}px; height: ${mapHeight}px; background: center / cover no-repeat; }
    </style></head><body>
        <div class="band"><div class="title">Ride the<br>Rails</div>
            <div class="subtitle">Six railroads · coast to coast</div></div>
        <div class="rule"></div>
        <div class="map"></div>
    </body></html>`
    const tab = await browser.newPage({ viewport: { width: Width, height: Height } })
    await tab.setContent(page)
    await tab.evaluate(
        async ({ family, bytes, photo }) => {
            const face = new FontFace(family, new Uint8Array(bytes), { weight: '700' })
            document.fonts.add(await face.load())
            const url = URL.createObjectURL(
                new Blob([new Uint8Array(photo)], { type: 'image/png' })
            )
            const map = document.querySelector('.map')
            map.style.backgroundImage = `url(${url})`
            await new Promise((resolve) => {
                const image = new Image()
                image.onload = resolve
                image.src = url
            })
            await document.fonts.ready
        },
        { ...serif, photo: [...map] }
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
    rmSync(scenarioFile, { force: true })
}
