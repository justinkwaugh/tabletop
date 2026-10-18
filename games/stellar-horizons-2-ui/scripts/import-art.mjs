// Converts Stellar Horizons II art from the unpacked Vassal module into the UI's image set.
// Usage: node scripts/import-art.mjs <unpacked-vassal-dir>   (requires ImageMagick `convert`)
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const vassalDir = process.argv[2] ?? '/workspace/artassets/stellar-horizons-2/vassal/unpacked'
const images = join(vassalDir, 'images')
const root = new URL('..', import.meta.url).pathname
const outDir = join(root, 'src/lib/images/art')
const manifestPath = join(root, 'src/lib/art/manifest.ts')
const sources = JSON.parse(readFileSync(join(root, 'scripts/art-sources.json'), 'utf8'))

const SYSTEM_SCALE = 0.5
const BOARD_SYSTEMS = [
    'sol',
    'v2306-ophiuchi',
    'barnards-star',
    'wise-0855-0714',
    'procyon',
    'gliese-876',
    'luhman-16',
    'alpha-centauri',
    'sirius',
    'vega',
    '61-cygni',
    'altair',
    'fomalhaut',
    'beta-comae-berenices',
    'epsilon-indi',
    'beta-hydri',
    'delta-pavonis',
    '61-virginis',
    'trappist-1',
    'arcturus',
    'gamma-serpentis',
    '72-herculis',
    '26-draconis',
    'alpha-mensae',
    'innes-star',
    'beta-aquilae',
    '18-scorpii',
    'tau-ceti',
    'epsilon-eridani',
    'gliese-251',
    'luytens-star',
    'kapteyns-star',
    'gx-andromedae',
    'lalande-21185',
    'wolf-359',
    'ross-128'
]
const FACTION_ART = {
    Consortium: 'Consortium',
    Givers: 'Givers',
    Praetorians: 'Praetorians',
    Starfarers: 'Starfarers',
    Syndicate: 'Syndicate',
    Transhumanists: 'Transhumanist',
    TruePath: 'True Path'
}
const FIELD_ART = { Biology: 'Biology', Physics: 'Physics', Engineering: 'Engineering' }
const EXPLORATION_ART = {
    Biology: 'EXP Value Bio Blank.png',
    Physics: 'EXP Value Phy Blank.png',
    Engineering: 'EXP Value Eng blank.png'
}

// Two module file names differ from the printed tile: "Alien derelict" and "Violent Separtists".
const ANOMALY_ART = {
    'adorable-critters': 'Adorable Critters.png',
    'alien-artifacts': 'Alien Artifacts.png',
    'alien-derelict': 'Alien derelict.png',
    'alien-remains': 'Alien Remains.png',
    'alien-sentinel': 'Alien Sentinel.png',
    'anarchist-outpost': 'Anarchist Outpost.png',
    'asteroid-clouds': 'Asteroid Clouds.png',
    'colossal-comet': 'Colossal Comet.png',
    'decapod-infestation': 'Decapod Infestation.png',
    dissidents: 'Dissidents.png',
    'hostile-xenomorphs': 'Hostile Xenomorphs.png',
    'ice-caverns': 'Ice Caverns.png',
    'medicinal-herbs': 'Medicinal Herbs.png',
    megafauna: 'Megafauna.png',
    'mineral-veins': 'Mineral Veins.png',
    'nanobot-swarm': 'Nanobot Swarm.png',
    'natural-stimulants': 'Natural Stimulants.png',
    'pirate-lair': 'Pirate Lair.png',
    'predatory-plants': 'Predatory Plants.png',
    'primal-carnivores': 'Primal Carnivores.png',
    'rare-crystals': 'Rare Crystals.png',
    'rescue-scout-ship': 'Rescue Scout Ship.png',
    'savage-storms': 'Savage Storms.png',
    'severe-radiation': 'Severe Radiation.png',
    'shadow-fleet': 'Shadow Fleet.png',
    'splinter-colony': 'Splinter Colony.png',
    'stellar-chart': 'Stellar Chart.png',
    'stellar-flares': 'Stellar Flares.png',
    'stunning-vistas': 'Stunning Vistas.png',
    'symbiotic-spores': 'Symbiotic Spores.png',
    'system-quarantine': 'System Quarantine.png',
    'terran-dna': 'Terran DNA.png',
    'tunnel-complex': 'Tunnel Complex.png',
    'violent-separatists': 'Violent Separtists.png'
}

rmSync(outDir, { recursive: true, force: true })
for (const dir of [
    'systems',
    'ships',
    'ships-flagless',
    'worlds',
    'markers',
    'factions',
    'anomalies'
]) {
    mkdirSync(join(outDir, dir), { recursive: true })
}

function convert(args) {
    execFileSync('convert', args, { stdio: 'inherit' })
}

// The printed markers carry their value over the emblem, so the blank face is the "1" marker
// with its white digit cut out and the hole filled from progressively blurred surroundings.
function blankTechMarker(art, target) {
    const work = mkdtempSync(join(tmpdir(), 'sh2-marker-'))
    const source = join(images, `Tech Marker ${art} 1.png`)
    const mask = join(work, 'mask.png')
    const holed = join(work, 'holed.png')
    convert([
        source,
        '-alpha',
        'off',
        '-fx',
        '(r>0.8&&g>0.8&&b>0.8&&i>28&&i<88&&j>12&&j<80)?1:0',
        '-morphology',
        'Dilate',
        'Disk:3',
        '-fx',
        'j<84?u:0',
        mask
    ])
    convert([
        source,
        '-alpha',
        'set',
        '(',
        mask,
        '-negate',
        ')',
        '-alpha',
        'off',
        '-compose',
        'CopyOpacity',
        '-composite',
        holed
    ])
    const fill = [25, 12, 6].flatMap((percent) => [
        '(',
        holed,
        '-resize',
        `${percent}%`,
        '-resize',
        '115x115!',
        ')',
        '-compose',
        'DstOver',
        '-composite'
    ])
    convert([
        holed,
        '(',
        holed,
        '-resize',
        '50%',
        '-resize',
        '115x115!',
        ')',
        '-compose',
        'DstOver',
        '-composite',
        ...fill,
        '-alpha',
        'off',
        '-quality',
        '82',
        join(outDir, target)
    ])
    rmSync(work, { recursive: true, force: true })
}

function webp(source, target, extra = []) {
    convert([join(images, source), ...extra, '-quality', '82', join(outDir, target)])
}

const imports = []
const entries = {
    systems: {},
    ships: {},
    shipsFlagless: {},
    worlds: {},
    settlements: {},
    factions: {},
    techMarkers: {},
    techMarkerBlanks: {},
    exploration: {},
    anomalies: {}
}
let importIndex = 0
function register(group, key, path) {
    const name = `art${importIndex++}`
    imports.push(`import ${name} from '$lib/images/art/${path}'`)
    entries[group][key] = name
}

for (const systemId of BOARD_SYSTEMS) {
    const { bbox } = sources.systems[systemId]
    const [x0, y0, x1, y1] = bbox
    const width = x1 - x0
    const height = y1 - y0
    const hex = [
        [width * 0.25, 0],
        [width * 0.75, 0],
        [width, height / 2],
        [width * 0.75, height],
        [width * 0.25, height],
        [0, height / 2]
    ]
        .map(([x, y]) => `${Math.round(x)},${Math.round(y)}`)
        .join(' ')
    const target = `systems/${systemId}.webp`
    convert([
        join(images, 'Space 3.jpg'),
        '-crop',
        `${width}x${height}+${x0}+${y0}`,
        '+repage',
        '-alpha',
        'set',
        '(',
        '-size',
        `${width}x${height}`,
        'xc:black',
        '-fill',
        'white',
        '-draw',
        `polygon ${hex}`,
        ')',
        '-alpha',
        'off',
        '-compose',
        'CopyOpacity',
        '-composite',
        '-resize',
        `${SYSTEM_SCALE * 100}%`,
        '-quality',
        '82',
        join(outDir, target)
    ])
    register('systems', systemId, target)
}

function readCounter(source) {
    const path = join(images, source)
    const [width, height] = execFileSync('convert', [path, '-format', '%w %h', 'info:'])
        .toString()
        .split(' ')
        .map(Number)
    const pixels = execFileSync('convert', [path, '-depth', '8', 'rgb:-'])
    const at = (x, y) => pixels.subarray((y * width + x) * 3, (y * width + x) * 3 + 3)
    // The right edge of every counter is plain background, which shades by row only.
    const isArt = (x, y, threshold) => {
        const pixel = at(x, y)
        const background = at(width - 1, y)
        return pixel.reduce((sum, value, i) => sum + Math.abs(value - background[i]), 0) > threshold
    }
    return { width, height, pixels, at, isArt }
}

// The module draws most counters wider than the printed square ones, with empty background on
// the right, so each is cropped to the square around its art.
function squareCounterCrop(counter) {
    const { width, height, isArt } = counter
    if (width <= height) {
        return []
    }
    let left = width
    let right = 0
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (isArt(x, y, 60)) {
                left = Math.min(left, x)
                right = Math.max(right, x)
            }
        }
    }
    const offset = Math.round((left + right + 1) / 2 - height / 2)
    const x = Math.min(Math.max(offset, 0), width - height)
    return ['-crop', `${height}x${height}+${x}+0`, '+repage']
}

// A faction's flag has the same size on all its counters but shifts by a few pixels, so each
// counter's flag is found by growing out from its middle. Where it runs into the ship or the
// text, it is cut back to the faction's usual flag size. The erased area is padded to take in
// the flag's soft shadow.
const FLAG_REGION = { width: 110, height: 66 }
const FLAG_SEED = { x: 30, y: 30 }
const FLAG_THRESHOLD = 24
const FLAG_PADDING = 3
const FLAG_TOLERANCE = 3
function flagExtent(counter) {
    const seen = new Set()
    const queue = [[FLAG_SEED.x, FLAG_SEED.y]]
    const bounds = { left: FLAG_SEED.x, right: FLAG_SEED.x, top: FLAG_SEED.y, bottom: FLAG_SEED.y }
    while (queue.length > 0) {
        const [x, y] = queue.pop()
        const key = y * FLAG_REGION.width + x
        if (x < 0 || y < 0 || x >= FLAG_REGION.width || y >= FLAG_REGION.height) continue
        if (seen.has(key) || !counter.isArt(x, y, FLAG_THRESHOLD)) continue
        seen.add(key)
        bounds.left = Math.min(bounds.left, x)
        bounds.right = Math.max(bounds.right, x)
        bounds.top = Math.min(bounds.top, y)
        bounds.bottom = Math.max(bounds.bottom, y)
        for (const [dx, dy] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1]
        ]) {
            queue.push([x + dx, y + dy])
        }
    }
    return bounds
}

function median(values) {
    const sorted = values.toSorted((x, y) => x - y)
    return sorted[Math.floor(sorted.length / 2)]
}

function flagBounds(counters) {
    const extents = counters.map(flagExtent)
    const width = median(extents.map((extent) => extent.right - extent.left))
    const height = median(extents.map((extent) => extent.bottom - extent.top))
    return extents.map((extent) => ({
        left: Math.max(0, extent.left - FLAG_PADDING),
        right: Math.min(extent.right, extent.left + width + FLAG_TOLERANCE) + FLAG_PADDING,
        top: Math.max(0, extent.top - FLAG_PADDING),
        bottom: Math.min(extent.bottom, extent.top + height + FLAG_TOLERANCE) + FLAG_PADDING
    }))
}

function withoutFlag(counter, flag) {
    const { width, pixels, at } = counter
    const result = Buffer.from(pixels)
    for (let y = flag.top; y <= flag.bottom; y++) {
        const background = at(width - 1, y)
        for (let x = flag.left; x <= flag.right; x++) {
            background.copy(result, (y * width + x) * 3)
        }
    }
    return result
}

const counters = Object.entries(sources.ships).map(([shipId, [front]]) => ({
    shipId,
    faction: shipId.split('-')[0],
    counter: readCounter(front)
}))
const flags = new Map()
for (const faction of new Set(counters.map((entry) => entry.faction))) {
    const own = counters.filter((entry) => entry.faction === faction)
    const bounds = flagBounds(own.map((entry) => entry.counter))
    own.forEach((entry, index) => flags.set(entry.shipId, bounds[index]))
}

const rawDir = mkdtempSync(join(tmpdir(), 'sh2-counters-'))
for (const { shipId, counter } of counters) {
    const crop = squareCounterCrop(counter)
    const raw = join(rawDir, `${shipId}.rgb`)
    const size = ['-size', `${counter.width}x${counter.height}`, '-depth', '8']
    writeFileSync(raw, counter.pixels)
    const target = `ships/${shipId}.webp`
    convert([...size, `rgb:${raw}`, ...crop, '-quality', '82', join(outDir, target)])
    register('ships', shipId, target)

    writeFileSync(raw, withoutFlag(counter, flags.get(shipId)))
    const flagless = `ships-flagless/${shipId}.webp`
    convert([...size, `rgb:${raw}`, ...crop, '-quality', '82', join(outDir, flagless)])
    register('shipsFlagless', shipId, flagless)
}
rmSync(rawDir, { recursive: true, force: true })

const worldFiles = new Map()
for (const [tileId, faces] of Object.entries(sources.worlds)) {
    const urls = {}
    for (const [side, file] of [
        ['I', faces[0]],
        ['II', faces[1]]
    ]) {
        if (!file) continue
        if (!worldFiles.has(file)) {
            const target = `worlds/${file.replace(/\.png$/, '').replace(/[^A-Za-z0-9-]+/g, '-')}.webp`
            webp(file, target)
            register('worlds', file, target)
            worldFiles.set(file, entries.worlds[file])
        }
        urls[side] = worldFiles.get(file)
    }
    entries.worlds[tileId] = urls
}
for (const file of worldFiles.keys()) delete entries.worlds[file]

for (const [faction, art] of Object.entries(FACTION_ART)) {
    webp(`${art} Faction.png`, `factions/${faction}.webp`)
    register('factions', faction, `factions/${faction}.webp`)
    // The token art carries a baked drop shadow along its right and bottom edges.
    webp(`Settlement ${art} B.png`, `markers/settlement-${faction}.webp`, [
        '-gravity',
        'SouthEast',
        '-chop',
        '3x3',
        '+repage'
    ])
    register('settlements', faction, `markers/settlement-${faction}.webp`)
}
for (const [field, art] of Object.entries(FIELD_ART)) {
    for (const value of [1, 2, 3, 4, 5]) {
        const target = `markers/tech-${field}-${value}.webp`
        webp(`Tech Marker ${art} ${value}.png`, target)
        register('techMarkers', `${field}-${value}`, target)
    }
    blankTechMarker(art, `markers/tech-${field}-blank.webp`)
    register('techMarkerBlanks', field, `markers/tech-${field}-blank.webp`)
    webp(EXPLORATION_ART[field], `markers/exploration-${field}.webp`)
    register('exploration', field, `markers/exploration-${field}.webp`)
}

// Some module tiles carry a stray coloured line along one edge, so each is cut to a hexagon
// just inside its printed edge.
const ANOMALY_SIZE = { width: 253, height: 220 }
const ANOMALY_HEX = [
    [0.25, 0],
    [0.75, 0],
    [1, 0.5],
    [0.75, 1],
    [0.25, 1],
    [0, 0.5]
]
    .map(([x, y]) => {
        const inset = 3
        const px = inset + x * (ANOMALY_SIZE.width - inset * 2)
        const py = inset + y * (ANOMALY_SIZE.height - inset * 2)
        return `${Math.round(px)},${Math.round(py)}`
    })
    .join(' ')
// The difficulty is printed in a red triangle (combat) or a blue disc (science). Its place is
// read from each tile so the UI can draw the difficulty that applies over the printed one.
const BADGE_COLOURS = [
    [199, 28, 34],
    [0, 125, 183]
]
const BADGE_TOLERANCE = 40
const BADGE_MARGIN = 2
function anomalyPixels(file) {
    const { width, height } = ANOMALY_SIZE
    return execFileSync('convert', [
        join(images, file),
        '-resize',
        `${width}x${height}!`,
        '-alpha',
        'off',
        '-depth',
        '8',
        'rgb:-'
    ])
}

function anomalyBadge(pixels) {
    const { width, height } = ANOMALY_SIZE
    const matches = (x, y, colour) => {
        const offset = (y * width + x) * 3
        const distance = colour.reduce(
            (sum, value, channel) => sum + Math.abs(value - pixels[offset + channel]),
            0
        )
        return distance <= BADGE_TOLERANCE
    }
    // Only pixels well inside a patch of the colour count, which leaves out the blended edges
    // of the tile's title, drawn in a lighter shade of the same hue.
    const isInside = (x, y, colour) => {
        for (let dy = -BADGE_MARGIN; dy <= BADGE_MARGIN; dy++) {
            for (let dx = -BADGE_MARGIN; dx <= BADGE_MARGIN; dx++) {
                if (!matches(x + dx, y + dy, colour)) return false
            }
        }
        return true
    }
    const boxes = BADGE_COLOURS.map((colour) => {
        const box = { left: width, top: height, right: 0, bottom: 0, n: 0 }
        for (let y = BADGE_MARGIN; y < height - BADGE_MARGIN; y++) {
            for (let x = BADGE_MARGIN; x < width - BADGE_MARGIN; x++) {
                if (!isInside(x, y, colour)) continue
                box.left = Math.min(box.left, x - BADGE_MARGIN)
                box.right = Math.max(box.right, x + BADGE_MARGIN)
                box.top = Math.min(box.top, y - BADGE_MARGIN)
                box.bottom = Math.max(box.bottom, y + BADGE_MARGIN)
                box.n += 1
            }
        }
        return box
    })
    const box = boxes.reduce((best, candidate) => (candidate.n > best.n ? candidate : best))
    return {
        x: (box.left + box.right + 1) / 2,
        y: (box.top + box.bottom + 1) / 2,
        width: box.right - box.left + 1,
        height: box.bottom - box.top + 1
    }
}

const anomalyBadges = {}
for (const [anomalyId, file] of Object.entries(ANOMALY_ART)) {
    const size = `${ANOMALY_SIZE.width}x${ANOMALY_SIZE.height}`
    webp(file, `anomalies/${anomalyId}.webp`, [
        '-resize',
        `${size}!`,
        '-alpha',
        'set',
        '(',
        '-size',
        size,
        'xc:black',
        '-fill',
        'white',
        '-draw',
        `polygon ${ANOMALY_HEX}`,
        ')',
        '-alpha',
        'off',
        '-compose',
        'CopyOpacity',
        '-composite'
    ])
    register('anomalies', anomalyId, `anomalies/${anomalyId}.webp`)
    anomalyBadges[anomalyId] = anomalyBadge(anomalyPixels(file))
}

const worldLines = Object.entries(entries.worlds).map(
    ([tileId, urls]) => `    '${tileId}': { I: ${urls.I}${urls.II ? `, II: ${urls.II}` : ''} },`
)
const record = (group) =>
    Object.entries(entries[group]).map(([key, name]) => `    '${key}': ${name},`)
const geometry = Object.fromEntries(
    BOARD_SYSTEMS.map((systemId) => {
        const { bbox, slots, marker } = sources.systems[systemId]
        return [systemId, { width: bbox[2] - bbox[0], height: bbox[3] - bbox[1], slots, marker }]
    })
)

writeFileSync(
    manifestPath,
    `// Generated by scripts/import-art.mjs from the Stellar Horizons II Vassal module.
${imports.join('\n')}

export const SYSTEM_ART: Record<string, string> = {
${record('systems').join('\n')}
}

export const SYSTEM_GEOMETRY: Record<
    string,
    { width: number; height: number; slots: number[][]; marker: number[] | null }
> = ${JSON.stringify(geometry)}

export const SHIP_ART: Record<string, string> = {
${record('ships').join('\n')}
}

export const FLAGLESS_SHIP_ART: Record<string, string> = {
${record('shipsFlagless').join('\n')}
}

export const WORLD_ART: Record<string, { I: string; II?: string }> = {
${worldLines.join('\n')}
}

export const FACTION_ART: Record<string, string> = {
${record('factions').join('\n')}
}

export const SETTLEMENT_ART: Record<string, string> = {
${record('settlements').join('\n')}
}

export const TECH_MARKER_ART: Record<string, string> = {
${record('techMarkers').join('\n')}
}

export const TECH_MARKER_BLANK_ART: Record<string, string> = {
${record('techMarkerBlanks').join('\n')}
}

export const EXPLORATION_MARKER_ART: Record<string, string> = {
${record('exploration').join('\n')}
}

export const ANOMALY_ART: Record<string, string> = {
${record('anomalies').join('\n')}
}

export const ANOMALY_ART_SIZE = ${JSON.stringify(ANOMALY_SIZE)}

export const ANOMALY_BADGE: Record<
    string,
    { x: number; y: number; width: number; height: number }
> = ${JSON.stringify(anomalyBadges)}
`
)
console.log(`Wrote ${importIndex + 1} images and ${manifestPath}`)
