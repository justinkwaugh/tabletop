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
    'sirius'
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

rmSync(outDir, { recursive: true, force: true })
for (const dir of ['systems', 'ships', 'worlds', 'markers', 'factions']) {
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
    worlds: {},
    settlements: {},
    factions: {},
    techMarkers: {},
    techMarkerBlanks: {},
    exploration: {}
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

for (const [shipId, [front]] of Object.entries(sources.ships)) {
    const target = `ships/${shipId}.webp`
    webp(front, target)
    register('ships', shipId, target)
}

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
    webp(`Settlement ${art} B.png`, `markers/settlement-${faction}.webp`)
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
`
)
console.log(`Wrote ${importIndex + 1} images and ${manifestPath}`)
