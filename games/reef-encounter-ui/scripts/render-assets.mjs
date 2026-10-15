// Cuts Reef Encounter's art out of the official print files (R&D Games) into the images the UI
// shows, in src/lib/images, and writes src/lib/images/art.generated.ts to import them, because the
// rollup bundle cannot resolve `import.meta.glob`.
//
// The print files are not in the repository. Needs ImageMagick (`convert`).
// Run from games/reef-encounter-ui: node scripts/render-assets.mjs <folder of official files>
// then format the manifest: pnpm exec prettier --write src/lib/images/art.generated.ts
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const source = process.argv[2]
if (!source) {
    console.error('Usage: node scripts/render-assets.mjs <folder of official files>')
    process.exit(1)
}
const images = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'lib', 'images')
const from = (name) => path.join(source, name)
const convert = (...args) => execFileSync('convert', args.flat(Infinity))
// Lossy WebP, the format the repository wants for opaque artwork.
const Lossy = [
    '-strip',
    '-define',
    'webp:lossless=false',
    '-define',
    'webp:method=6',
    '-quality',
    '82'
]

// Everything is scaled so a reef board square becomes 144 pixels: twice the 72 pixels the table
// draws it at, so it stays sharp on high-density screens.
const ReefSquare = 342.2
const Scale = 144 / ReefSquare

const Colors = ['grey', 'orange', 'pink', 'white', 'yellow']
const SheetName = { grey: 'Grey', orange: 'Orange', pink: 'Pink', white: 'White', yellow: 'Yellow' }

// Grey polyps are darkened so they read apart from white ones: a 40% tone stretch keeps the
// whitest parts while the background and ink lines darken, then everything goes to 80%. Sea
// creatures, the only strongly coloured pixels on a grey tile, keep their printed colour.
const GreyTreatment = ['-level', '40%,100%', '-evaluate', 'multiply', '0.8']
// The other colours keep their hue but gain contrast: only lightness is stretched, by 25%.
const ColourTreatment = [
    '-colorspace',
    'Lab',
    '-channel',
    'R',
    '-level',
    '25%,100%',
    '+channel',
    '-colorspace',
    'sRGB'
]
const treatment = (color) => (color === 'grey' ? GreyTreatment : ColourTreatment)

function processGrey(file) {
    const mask = `${file}.mask.png`
    const treated = `${file}.treated.png`
    convert(
        file,
        '-fx',
        'max(max(r,g),b)-min(min(r,g),b)',
        '-threshold',
        '13%',
        '-morphology',
        'Open',
        'Disk:1.5',
        '-morphology',
        'Dilate',
        'Disk:2.5',
        '-blur',
        '0x1.2',
        mask
    )
    convert(file, GreyTreatment, treated)
    convert(treated, file, mask, '-composite', file)
    execFileSync('rm', [mask, treated])
}

// Reef boards: every board shares a grid at (330, 668) with 342.2 by 340.7 pixel squares, and a
// flat print margin above and below the art, cropped away here.
const BoardCrop = { y: 290, height: 3320 }
mkdirSync(path.join(images, 'boards'), { recursive: true })
for (const id of [1, 2, 3, 4]) {
    convert(
        from(`Board${id}.png`),
        '-crop',
        `2717x${BoardCrop.height}+0+${BoardCrop.y}`,
        '+repage',
        '-filter',
        'Lanczos',
        '-resize',
        `${Math.round(2717 * Scale)}x`,
        Lossy,
        path.join(images, 'boards', `board-${id}.webp`)
    )
}
convert(
    from('Open_Sea_Board.png'),
    '-filter',
    'Lanczos',
    '-resize',
    `${Math.round(3744 * Scale)}x`,
    Lossy,
    path.join(images, 'open-sea.webp')
)

// Polyp tiles: each colour's sheet holds 40 tiles, painted differently on each side. The back
// sheet is the front mirrored left to right. Rows 0-1 have eight tiles; rows 2-5 have six, at
// the right of the front and the left of the back.
const PolypPitch = { x: 413.3, y: 396.5 }
const PolypOrigin = { x: 201, y: 183 }
const PolypSize = 366
const PolypInset = 6
const PolypPixels = 144
function polypColumns(row, side) {
    if (row < 2) return [0, 1, 2, 3, 4, 5, 6, 7]
    return side === 'front' ? [2, 3, 4, 5, 6, 7] : [0, 1, 2, 3, 4, 5]
}
mkdirSync(path.join(images, 'polyps'), { recursive: true })
const polypFaces = {}
for (const color of Colors) {
    polypFaces[color] = []
    for (const side of ['front', 'back']) {
        const sheet = from(`${SheetName[color]}_Tiles-${side}.png`)
        for (let row = 0; row < 6; row++) {
            for (const col of polypColumns(row, side)) {
                const x = Math.round(PolypOrigin.x + col * PolypPitch.x + PolypInset)
                const y = Math.round(PolypOrigin.y + row * PolypPitch.y + PolypInset)
                const size = PolypSize - 2 * PolypInset
                const name = `${color}-${String(polypFaces[color].length).padStart(2, '0')}.webp`
                const file = path.join(images, 'polyps', name)
                if (color === 'grey') {
                    const work = `${file}.png`
                    convert(sheet, '-crop', `${size}x${size}+${x}+${y}`, '+repage', work)
                    processGrey(work)
                    convert(
                        work,
                        '-filter',
                        'Lanczos',
                        '-resize',
                        `${PolypPixels}x${PolypPixels}`,
                        Lossy,
                        file
                    )
                    execFileSync('rm', [work])
                } else {
                    convert(
                        sheet,
                        '-crop',
                        `${size}x${size}+${x}+${y}`,
                        '+repage',
                        ColourTreatment,
                        '-filter',
                        'Lanczos',
                        '-resize',
                        `${PolypPixels}x${PolypPixels}`,
                        Lossy,
                        file
                    )
                }
                polypFaces[color].push(`./polyps/${name}`)
            }
        }
    }
}

// Coral tiles: each colour's sheet holds the two tiles on which that colour is stronger on the
// starfish side, the starfish side on the front sheet and the plain side opposite it on the back.
// A face shows its stronger coral across the top, its algae at the bottom left and its weaker coral
// at the bottom right. Each coral gets its own colour's treatment; the algae stay as printed.
const CoralTileSize = 544
const CoralTileRows = [1195, 1988]
const CoralTileX = { front: 201, back: 2917 }
const CoralTilePixels = Math.round(473 * Scale)
const SheetTiles = { grey: [1, 6], orange: [2, 7], pink: [4, 9], white: [3, 8], yellow: [5, 10] }
// Starfish side: stronger and weaker coral (src/components/coralTiles.ts in the logic package).
const StarfishSide = {
    1: ['grey', 'yellow'],
    2: ['orange', 'pink'],
    3: ['white', 'yellow'],
    4: ['pink', 'grey'],
    5: ['yellow', 'pink'],
    6: ['grey', 'white'],
    7: ['orange', 'grey'],
    8: ['white', 'orange'],
    9: ['pink', 'white'],
    10: ['yellow', 'orange']
}
mkdirSync(path.join(images, 'coral-tiles'), { recursive: true })
const coralFaces = {}
for (const color of Colors) {
    SheetTiles[color].forEach((tileId, index) => {
        coralFaces[tileId] = {}
        for (const side of ['front', 'back']) {
            const [frontStronger, frontWeaker] = StarfishSide[tileId]
            const [stronger, weaker] =
                side === 'front' ? [frontStronger, frontWeaker] : [frontWeaker, frontStronger]
            const half = CoralTileSize / 2
            const face = side === 'front' ? 'starfish' : 'plain'
            const name = `tile-${String(tileId).padStart(2, '0')}-${face}.webp`
            const file = path.join(images, 'coral-tiles', name)
            const work = `${file}.png`
            const piece = `${file}.piece.png`
            convert(
                from(`${SheetName[color]}_Tiles-${side}.png`),
                '-crop',
                `${CoralTileSize}x${CoralTileSize}+${CoralTileX[side]}+${CoralTileRows[index]}`,
                '+repage',
                work
            )
            const corals = [
                { color: stronger, size: `${CoralTileSize}x${half}`, at: [0, 0] },
                { color: weaker, size: `${half}x${half}`, at: [half, half] }
            ]
            for (const coral of corals) {
                convert(
                    work,
                    '-crop',
                    `${coral.size}+${coral.at[0]}+${coral.at[1]}`,
                    '+repage',
                    treatment(coral.color),
                    piece
                )
                convert(
                    work,
                    piece,
                    '-geometry',
                    `+${coral.at[0]}+${coral.at[1]}`,
                    '-composite',
                    work
                )
            }
            convert(
                work,
                '-filter',
                'Lanczos',
                '-resize',
                `${CoralTilePixels}x${CoralTilePixels}`,
                Lossy,
                file
            )
            execFileSync('rm', [work, piece])
            coralFaces[tileId][face] = `./coral-tiles/${name}`
        }
    })
}

// Each player's parrotfish, from the parrotfish box art, for the player panels: one fish of the
// player's colour swimming level, in a strip at twice the panel's 320 by 120 size.
const BoxArtScale = 2.278
const ParrotfishCrops = {
    purple: { file: 'Parrotfish_outside-Purple_Red.png', box: [320, 470, 760, 635] },
    red: { file: 'Parrotfish_outside-Purple_Red.png', box: [640, 472, 1075, 637] },
    yellow: { file: 'Parrotfish_outside-Yellow_Green.png', box: [320, 118, 760, 283] },
    green: { file: 'Parrotfish_outside-Yellow_Green.png', box: [935, 470, 1375, 635] }
}
mkdirSync(path.join(images, 'parrotfish'), { recursive: true })
for (const [color, { file, box }] of Object.entries(ParrotfishCrops)) {
    const [x0, y0, x1, y1] = box.map((value) => Math.round(value * BoxArtScale))
    convert(
        from(file),
        '-crop',
        `${x1 - x0}x${y1 - y0}+${x0}+${y0}`,
        '+repage',
        '-filter',
        'Lanczos',
        '-resize',
        '640x240!',
        Lossy,
        path.join(images, 'parrotfish', `${color}.webp`)
    )
}

// The cover, from the user's colour-corrected copy of the CMYK original, at twice the catalog's
// 340-pixel large-card height.
convert(
    from('Cover_Art-color_correction.png'),
    '-filter',
    'Lanczos',
    '-resize',
    'x680',
    '-unsharp',
    '0x0.8+0.5+0.01',
    '-strip',
    '-define',
    'webp:lossless=false',
    '-quality',
    '90',
    path.join(images, 'cover.webp')
)

// The player aid: the English reference card from the back of the action card sheet, printed
// upside down there, at twice its 400-pixel display width.
convert(
    from('Action_cards_back-4x.png'),
    '-crop',
    '1100x1580+210+1830',
    '+repage',
    '-rotate',
    '180',
    '-filter',
    'Lanczos',
    '-resize',
    '800x',
    '-strip',
    '-define',
    'webp:lossless=false',
    '-quality',
    '88',
    path.join(images, 'reference-card.webp')
)

// The manifest: one static import per image.
const lines = ['// Generated by scripts/render-assets.mjs from the official art; do not edit.', '']
let next = 0
const ref = (file) => {
    const name = `image${next++}`
    lines.push(`import ${name} from '${file}'`)
    return name
}
const polypRefs = Object.fromEntries(Colors.map((color) => [color, polypFaces[color].map(ref)]))
const coralRefs = Object.fromEntries(
    Object.entries(coralFaces).map(([id, faces]) => [
        id,
        { starfish: ref(faces.starfish), plain: ref(faces.plain) }
    ])
)
const boardRefs = [1, 2, 3, 4].map((id) => ref(`./boards/board-${id}.webp`))
const openSeaRef = ref('./open-sea.webp')
const parrotfishRefs = Object.keys(ParrotfishCrops).map((color) => [
    color,
    ref(`./parrotfish/${color}.webp`)
])
lines.push(
    '',
    'export const PolypFaceUrls = {',
    ...Colors.map((color) => `    ${color}: [${polypRefs[color].join(', ')}],`),
    '}',
    '',
    'export const CoralTileFaceUrls: Record<number, { starfish: string; plain: string }> = {',
    ...Object.entries(coralRefs).map(
        ([id, r]) => `    ${id}: { starfish: ${r.starfish}, plain: ${r.plain} },`
    ),
    '}',
    '',
    `export const BoardImageUrls = { 1: ${boardRefs[0]}, 2: ${boardRefs[1]}, 3: ${boardRefs[2]}, 4: ${boardRefs[3]} }`,
    '',
    `export const OpenSeaImageUrl = ${openSeaRef}`,
    '',
    `export const ParrotfishUrls: Record<string, string> = { ${parrotfishRefs.map(([color, name]) => `${color}: ${name}`).join(', ')} }`,
    ''
)
writeFileSync(path.join(images, 'art.generated.ts'), lines.join('\n'))
console.log(
    `Wrote ${Colors.length * 80} polyp faces, 20 coral tile faces, 4 boards, the open sea, the cover and the reference card`
)
