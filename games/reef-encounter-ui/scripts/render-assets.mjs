// Cuts Reef Encounter's art out of the official print files (R&D Games) into the images the UI
// shows, in src/lib/images, and writes src/lib/images/art.generated.ts to import them, because the
// rollup bundle cannot resolve `import.meta.glob`.
//
// The print files are not in the repository. Needs ImageMagick (`convert`).
// Run from games/reef-encounter-ui: node scripts/render-assets.mjs <folder of official files>
// then format the manifest: pnpm exec prettier --write src/lib/images/art.generated.ts
import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
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

// Polyp tiles: each colour's sheet holds 40 tiles. The back sheet is the front mirrored left to
// right, so a tile's back is mostly its front's mirror image; only a few backs add or lose a small
// sea creature. Those backs are kept; every other back is drawn by mirroring its front. Rows 0-1
// have eight tiles; rows 2-5 have six, at the right of the front and the left of the back.
const PolypPitch = { x: 413.3, y: 396.5 }
const PolypOrigin = { x: 201, y: 183 }
const PolypSize = 366
const PolypInset = 6
const PolypPixels = 144
function polypColumns(row, side) {
    if (row < 2) return [0, 1, 2, 3, 4, 5, 6, 7]
    return side === 'front' ? [2, 3, 4, 5, 6, 7] : [0, 1, 2, 3, 4, 5]
}
// A back counts as its front's mirror image when, mirrored back, fewer than 40 of its pixels
// differ from the front by more than a fifth in any channel. The rest differ by hundreds.
function isMirrorOf(back, front) {
    const work = `${back}.diff.png`
    convert(
        back,
        '-flop',
        front,
        '-compose',
        'difference',
        '-composite',
        '-blur',
        '0x1',
        '-separate',
        '-evaluate-sequence',
        'max',
        '-threshold',
        '20%',
        work
    )
    const differing = Number(
        execFileSync('convert', [work, '-format', '%[fx:mean*w*h]', 'info:']).toString()
    )
    execFileSync('rm', [work])
    return differing < 40
}

mkdirSync(path.join(images, 'polyps'), { recursive: true })
const polypFaces = {}
for (const color of Colors) {
    polypFaces[color] = []
    const fronts = new Map()
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
                const ref = `./polyps/${name}`
                if (side === 'front') {
                    fronts.set(`${row}:${col}`, { file, ref })
                    polypFaces[color].push({ ref, mirrored: false })
                    continue
                }
                const front = fronts.get(`${row}:${7 - col}`)
                if (isMirrorOf(file, front.file)) {
                    execFileSync('rm', [file])
                    polypFaces[color].push({ ref: front.ref, mirrored: true })
                } else {
                    polypFaces[color].push({ ref, mirrored: false })
                }
            }
        }
    }
}

// Coral tiles: each colour's sheet holds the two tiles on which that colour is stronger on the
// starfish side, the starfish side on the front sheet and the plain side opposite it on the back.
// A face shows its stronger coral across the top, its algae at the bottom left and its weaker coral
// at the bottom right. Each coral gets its own colour's treatment, and three of the algae are
// shifted towards their cylinders' colours.
const CoralTileSize = 544
// Each shift picks an alga out of the algae corner by hue and saturation, leaving out the orange
// sponge in the corner's top right, and applies `-modulate lightness,saturation,hue`. The printed
// purple is magenta and read as red beside the red algae, so it turns violet; the blue is greyish
// and the green yellowish. Red already matches its cylinder and stays as printed.
const AlgaShifts = [
    // purple: hue -43°, saturation ×1.225, lightness ×0.91
    { picks: 'hue>0.775 && hue<0.955 && saturation>0.10', modulate: '91,122.5,76' },
    // blue: hue +5°, saturation ×1.9, lightness ×1.06
    { picks: 'hue>0.52 && hue<0.71 && saturation>0.15', modulate: '106,190,103' },
    // green: hue +11°, saturation ×1.05, lightness ×0.81
    { picks: 'hue>0.15 && hue<0.43 && saturation>0.2', modulate: '81,105,106' }
]
function shiftAlgae(file) {
    const mask = `${file}.mask.png`
    const shifted = `${file}.shifted.png`
    const original = `${file}.original.png`
    convert(file, original)
    for (const shift of AlgaShifts) {
        convert(
            original,
            '-fx',
            `(${shift.picks}) && !(i/w>0.68 && j/h<0.32) ? 1 : 0`,
            '-blur',
            '0x1.9',
            mask
        )
        convert(original, '-modulate', shift.modulate, shifted)
        convert(file, shifted, mask, '-composite', file)
    }
    execFileSync('rm', [mask, shifted, original])
}
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
            convert(work, '-crop', `${half}x${half}+0+${half}`, '+repage', piece)
            shiftAlgae(piece)
            convert(work, piece, '-geometry', `+0+${half}`, '-composite', work)
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

// The player panels' reef scene: each player's parrotfish and the five corals, cut out of the box
// bottom, where they are painted apart on a flat green. Boxes are in Box_bottom.png pixels.
// The background is keyed out, then only the largest piece is kept, which drops the edges of
// neighbouring paintings that fall inside a box.
const BoxBottomGreen = 'srgb(83,126,111)'
const ParrotfishCuts = {
    purple: [1204, 3964, 2117, 4462],
    green: [2075, 3715, 2947, 4171],
    red: [2802, 3839, 3694, 4484],
    yellow: [3715, 3715, 4628, 4130]
}
const CoralCuts = {
    white: [1287, 394, 1972, 1079],
    yellow: [1918, 519, 2503, 1017],
    pink: [2499, 291, 3113, 1017],
    grey: [3121, 477, 3839, 975],
    orange: [3839, 374, 4586, 1017]
}
const cutOut = ([x0, y0, x1, y1], height, out, turn = []) => {
    const keyed = path.join(images, 'scene', '.keyed.png')
    convert(
        from('Box_bottom.png'),
        ['-crop', `${x1 - x0}x${y1 - y0}+${x0}+${y0}`, '+repage'],
        ['-alpha', 'set', '-fuzz', '9%', '-transparent', BoxBottomGreen],
        ['-channel', 'A', '-morphology', 'Erode', 'Disk:1', '-blur', '0x0.8', '+channel'],
        keyed
    )
    // Pieces are found on the alpha dilated a little, so a fin or antenna stays with its body.
    const pieces = ['-alpha', 'extract', '-threshold', '50%', '-morphology', 'Dilate', 'Disk:8']
    const objects = execFileSync('convert', [
        keyed,
        ...pieces,
        '-define',
        'connected-components:verbose=true',
        '-connected-components',
        '8',
        'null:'
    ])
        .toString()
        .split('\n')
        .filter((line) => line.includes('gray(255)'))
        .map((line) => line.trim().split(/\s+/))
        .map(([id, , , area]) => ({ id: id.replace(':', ''), area: Number(area) }))
        .sort((a, b) => b.area - a.area)
    const stray = objects.slice(1).map(({ id }) => id)
    const mask = stray.length
        ? [
              '(',
              '+clone',
              ...pieces,
              ['-define', 'connected-components:mean-color=true'],
              ['-define', `connected-components:remove=${stray.join(',')}`],
              ['-connected-components', '8', '-threshold', '50%'],
              '(',
              '-clone',
              '0',
              '-alpha',
              'extract',
              ')',
              '-compose',
              'multiply',
              '-composite',
              ')',
              ['-compose', 'copy_opacity', '-composite']
          ]
        : []
    convert(
        keyed,
        mask,
        ['-trim', '+repage', ...turn, '-filter', 'Lanczos', '-resize', `x${height}`],
        Lossy,
        ['-define', 'webp:alpha-quality=90'],
        out
    )
    rmSync(keyed)
}
mkdirSync(path.join(images, 'scene'), { recursive: true })
// Twice the heights the panel header draws them at. The box bottom's fish swim along its lower
// edge upside down; turned round, they are upright and face left, towards the corals.
for (const [color, box] of Object.entries(ParrotfishCuts)) {
    cutOut(box, 104, path.join(images, 'scene', `parrotfish-${color}.webp`), ['-rotate', '180'])
}
// The panel draws the low grey and yellow corals 22 pixels high and the others 30.
const CoralHeights = { white: 60, yellow: 44, pink: 60, grey: 44, orange: 60 }
for (const [color, box] of Object.entries(CoralCuts)) {
    cutOut(box, CoralHeights[color], path.join(images, 'scene', `coral-${color}.webp`))
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
const refs = new Map()
const ref = (file) => {
    if (!refs.has(file)) {
        const name = `image${next++}`
        lines.push(`import ${name} from '${file}'`)
        refs.set(file, name)
    }
    return refs.get(file)
}
const polypRefs = Object.fromEntries(
    Colors.map((color) => [
        color,
        polypFaces[color].map((face) => `{ url: ${ref(face.ref)}, mirrored: ${face.mirrored} }`)
    ])
)
const coralRefs = Object.fromEntries(
    Object.entries(coralFaces).map(([id, faces]) => [
        id,
        { starfish: ref(faces.starfish), plain: ref(faces.plain) }
    ])
)
const boardRefs = [1, 2, 3, 4].map((id) => ref(`./boards/board-${id}.webp`))
const openSeaRef = ref('./open-sea.webp')
const parrotfishRefs = Object.keys(ParrotfishCuts).map((color) => [
    color,
    ref(`./scene/parrotfish-${color}.webp`)
])
const sceneCoralRefs = Object.keys(CoralCuts).map((color) => [
    color,
    ref(`./scene/coral-${color}.webp`)
])
lines.push(
    '',
    '// Each colour has 80 faces, the backs of most tiles being their fronts drawn mirrored.',
    'export const PolypFaces: Record<string, { url: string; mirrored: boolean }[]> = {',
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
    '',
    `export const SceneCoralUrls: Record<string, string> = { ${sceneCoralRefs.map(([color, name]) => `${color}: ${name}`).join(', ')} }`,
    ''
)
writeFileSync(path.join(images, 'art.generated.ts'), lines.join('\n'))
const polypFiles = Colors.reduce(
    (total, color) => total + polypFaces[color].filter((face) => !face.mirrored).length,
    0
)
console.log(
    `Wrote ${Colors.length * 80} polyp faces from ${polypFiles} images, 20 coral tile faces, 4 boards, the open sea, the cover and the reference card`
)
