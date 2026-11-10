// Cuts both packs' faces out of the scanned pages and writes src/lib/images/cards.generated.ts and
// classicCards.generated.ts to import them, because the rollup bundle cannot resolve globbed
// imports. It also draws the cover. Run scripts/measure-cards.mjs first if the scans change.
//
// Each card is straightened and cut by its measured placement, its paper is brought to one colour
// across its pack, and the scanner's lid, shadows and specks are painted out. The Tarot Nouveau
// prints French court indices, so its R D C V are replaced by K Q C J from index-letters.json: the
// K C J are Roboto Slab Medium (Apache 2.0) condensed, the Q is drawn to match, with a tail after
// the Bicycle pack's. The Industrie und Glück never printed red 10 9 8 7, so those are composed
// from its red pip, laid out like its black spades. Its trump II is turned so the eagle is on top.
//
//   node scripts/import-cards.mjs ../../my-materials/koenigrufen
//   pnpm exec prettier --write src/lib/images/*.generated.ts
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { TarotFrames } from './card-frames.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const [materials] = process.argv.slice(2)
if (!materials) throw new Error('Usage: node scripts/import-cards.mjs <materials folder>')

const placements = JSON.parse(readFileSync(path.join(here, 'card-placements.json'), 'utf8'))
const { capHeight, letterHeight, letters } = JSON.parse(
    readFileSync(path.join(here, 'index-letters.json'), 'utf8')
)
const images = path.join(here, '..', 'src', 'lib', 'images')

// Cards are written this tall, twice their usual height for sharp high-density screens.
const OutputHeight = 432
// The card component rounds its corners by 7% of the width; the faces match.
const CornerShare = 0.07
const Channels = 3

const trumps = (from, to) =>
    Array.from({ length: to - from + 1 }, (_, index) => `trump-${from + index}`)
const suit = (name, ...ranks) => ranks.map((rank) => (rank ? `${name}-${rank}` : null))

// The cards on each page in reading order; null marks a card the game does not use.
const TarotPages = {
    '0001': trumps(1, 6),
    '0002': trumps(7, 12),
    '0003': trumps(13, 18),
    '0004': trumps(19, 22),
    '0005': [...suit('clubs', 'K', 'Q', 'C', 'J'), ...suit('spades', 'K', 'Q')],
    '0006': [...suit('spades', 'C', 'J'), ...suit('hearts', 'K', 'Q', 'C', 'J')],
    '0007': suit('diamonds', 'K', 'Q', 'C', 'J'),
    '0008': [...suit('hearts', '10', '9', '8'), ...suit('diamonds', '10', '9', '8')],
    '0009': [...suit('hearts', '7', null, null), ...suit('diamonds', '7', null, null)],
    '0010': [...suit('hearts', '4', '3', '2'), ...suit('diamonds', '4', '3', '2')],
    '0011': [...suit('clubs', '10', '9', '8'), ...suit('spades', '10', '9', '8')],
    '0012': [...suit('clubs', '7', null, null), ...suit('spades', '7', null, null)],
    '0014': [null, null, 'hearts-1', 'diamonds-1']
}
const ClassicPages = {
    '0015': suit('hearts', 'K', 'Q', 'C', 'J', '1', '2'),
    '0016': [...suit('hearts', '3', '4'), ...suit('diamonds', '3', '4')],
    '0017': suit('diamonds', 'K', 'Q', 'C', 'J', '1', '2'),
    '0018': suit('clubs', 'K', 'Q', 'C', 'J', '8', '9'),
    '0019': [...suit('spades', '8', '7'), ...suit('clubs', '10', '7')],
    '0020': suit('spades', 'K', 'Q', 'C', 'J', '10', '9'),
    '0021': trumps(1, 6),
    '0022': trumps(7, 12),
    '0023': trumps(13, 18),
    '0024': trumps(19, 22)
}

const Tarot = {
    folder: 'tarot-nouveau',
    pages: TarotPages,
    width: 709,
    height: 1339,
    outputWidth: 229,
    paper: [251, 250, 246]
}
const Classic = {
    folder: 'industrie-and-gluck',
    pages: ClassicPages,
    width: 745,
    height: 1345,
    outputWidth: 239,
    paper: [250, 247, 237]
}

const isPip = (id) => /-\d+$/.test(id) && !id.startsWith('trump')
const isCourt = (id) => /-[KQCJ]$/.test(id)
const trumpNumber = (id) => (id.startsWith('trump') ? Number(id.split('-')[1]) : undefined)

// Catmull-Rom weights, for straightening a card without softening it.
function cubic(distance) {
    const away = Math.abs(distance)
    if (away < 1) return 1.5 * away ** 3 - 2.5 * away ** 2 + 1
    return away < 2 ? -0.5 * away ** 3 + 2.5 * away ** 2 - 4 * away + 2 : 0
}

function cut(page, { x, y, degrees }, width, height) {
    const card = Buffer.alloc(width * height * Channels)
    const angle = (degrees * Math.PI) / 180
    const [cos, sin] = [Math.cos(angle), Math.sin(angle)]
    const sample = (px, py, channel) =>
        page.data[
            (Math.min(page.height - 1, Math.max(0, py)) * page.width +
                Math.min(page.width - 1, Math.max(0, px))) *
                Channels +
                channel
        ]
    for (let row = 0; row < height; row++) {
        for (let column = 0; column < width; column++) {
            const [u, v] = [column + 0.5 - width / 2, row + 0.5 - height / 2]
            const sourceX = x + cos * u - sin * v - 0.5
            const sourceY = y + sin * u + cos * v - 0.5
            const [baseX, baseY] = [Math.floor(sourceX), Math.floor(sourceY)]
            for (let channel = 0; channel < Channels; channel++) {
                let sum = 0
                for (let j = -1; j <= 2; j++) {
                    const weightY = cubic(j - (sourceY - baseY))
                    for (let i = -1; i <= 2; i++) {
                        sum +=
                            weightY *
                            cubic(i - (sourceX - baseX)) *
                            sample(baseX + i, baseY + j, channel)
                    }
                }
                card[(row * width + column) * Channels + channel] = Math.max(
                    0,
                    Math.min(255, Math.round(sum))
                )
            }
        }
    }
    return card
}

function median(values) {
    return [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]
}

// How far a pixel lies from the paper, in its furthest channel.
function inkAt(card, offset, paper) {
    return Math.max(
        paper[0] - card[offset],
        paper[1] - card[offset + 1],
        paper[2] - card[offset + 2]
    )
}

// Scales each channel so the card's own paper lands on the pack's paper colour.
function balancePaper(card, paper) {
    const samples = [[], [], []]
    for (let offset = 0; offset < card.length; offset += Channels * 5) {
        if (Math.min(card[offset], card[offset + 1], card[offset + 2]) > 215) {
            for (let channel = 0; channel < Channels; channel++) {
                samples[channel].push(card[offset + channel])
            }
        }
    }
    const gains = samples.map((values, channel) => paper[channel] / median(values))
    for (let offset = 0; offset < card.length; offset += Channels) {
        for (let channel = 0; channel < Channels; channel++) {
            card[offset + channel] = Math.min(
                255,
                Math.round(card[offset + channel] * gains[channel])
            )
        }
    }
}

// Lays the scan's grain flat: what is nearly paper becomes paper, easing back in towards ink.
function settlePaper(card, paper) {
    const [Near, Far] = [10, 26]
    for (let offset = 0; offset < card.length; offset += Channels) {
        const blend = Math.min(1, Math.max(0, (inkAt(card, offset, paper) - Near) / (Far - Near)))
        for (let channel = 0; channel < Channels; channel++) {
            card[offset + channel] = Math.round(
                paper[channel] + (card[offset + channel] - paper[channel]) * blend
            )
        }
    }
}

// Connected shapes of ink, each a list of pixel indices, within an optional window.
function inkShapes(card, width, height, paper, threshold, window) {
    const { left = 0, top = 0, right = width, bottom = height } = window ?? {}
    const seen = new Uint8Array(width * height)
    const stack = new Int32Array(width * height)
    const shapes = []
    const inside = (x, y) => x >= left && x < right && y >= top && y < bottom
    const isInk = (pixel) => inkAt(card, pixel * Channels, paper) > threshold
    for (let y = top; y < bottom; y++) {
        for (let x = left; x < right; x++) {
            const start = y * width + x
            if (seen[start] || !isInk(start)) continue
            const shape = []
            let depth = 0
            stack[depth++] = start
            seen[start] = 1
            while (depth > 0) {
                const pixel = stack[--depth]
                shape.push(pixel)
                const [px, py] = [pixel % width, Math.floor(pixel / width)]
                for (const [nx, ny] of [
                    [px - 1, py],
                    [px + 1, py],
                    [px, py - 1],
                    [px, py + 1]
                ]) {
                    const next = ny * width + nx
                    if (inside(nx, ny) && !seen[next] && isInk(next)) {
                        seen[next] = 1
                        stack[depth++] = next
                    }
                }
            }
            shapes.push(shape)
        }
    }
    return shapes
}

function boundsOf(shape, width) {
    let [left, top, right, bottom] = [Infinity, Infinity, -1, -1]
    let [sumX, sumY] = [0, 0]
    for (const pixel of shape) {
        const [x, y] = [pixel % width, Math.floor(pixel / width)]
        left = Math.min(left, x)
        right = Math.max(right, x)
        top = Math.min(top, y)
        bottom = Math.max(bottom, y)
        sumX += x
        sumY += y
    }
    return {
        left,
        top,
        right,
        bottom,
        centreX: (left + right) / 2,
        centreY: (top + bottom) / 2,
        massY: sumY / shape.length,
        massX: sumX / shape.length
    }
}

function paintPaper(card, offset, paper) {
    for (let channel = 0; channel < Channels; channel++) card[offset + channel] = paper[channel]
}

function clearSpecks(card, width, height, paper) {
    const [SpeckInk, SpeckArea] = [24, 140]
    for (const shape of inkShapes(card, width, height, paper, SpeckInk)) {
        if (shape.length < SpeckArea) {
            for (const pixel of shape) paintPaper(card, pixel * Channels, paper)
        }
    }
}

// Paints everything outside a centred rounded rectangle, where only lid and shadow can be.
function clearBorder(card, width, height, paper, keepWidth, keepHeight, radius) {
    const [halfWidth, halfHeight] = [keepWidth / 2, keepHeight / 2]
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const dx = Math.abs(x + 0.5 - width / 2) - (halfWidth - radius)
            const dy = Math.abs(y + 0.5 - height / 2) - (halfHeight - radius)
            const beyond =
                Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0)
            if (beyond > radius) paintPaper(card, (y * width + x) * Channels, paper)
        }
    }
}

function halfTurn(pixels, channels) {
    const turned = Buffer.alloc(pixels.length)
    for (let offset = 0; offset < pixels.length; offset += channels) {
        pixels.copy(turned, pixels.length - offset - channels, offset, offset + channels)
    }
    return turned
}

// Letters are told from nearby art at this ink, past the soft edges that would bridge them.
const LetterInk = 150

function letterWindow(width, side) {
    const [Margin, Span] = [42, 100]
    return {
        left: side === 'left' ? Margin : width - Margin - Span,
        right: side === 'left' ? Margin + Span : width - Margin,
        top: 44,
        bottom: 175
    }
}

// The printed letter in one of a court card's top corners, with the other ink around it.
function findLetter(card, width, height, paper, side, id) {
    const shapes = inkShapes(card, width, height, paper, LetterInk, letterWindow(width, side))
    const isLetter = (shape) => {
        const { left, top, right, bottom } = boundsOf(shape, width)
        const [tall, wide] = [bottom - top + 1, right - left + 1]
        return tall >= 80 && tall <= 92 && wide >= 48 && wide <= 66
    }
    const found = shapes.filter(isLetter)
    if (found.length !== 1) throw new Error(`${id} ${side}: found ${found.length} corner letters`)
    return {
        shape: found[0],
        others: shapes.filter((shape) => shape !== found[0]),
        bounds: boundsOf(found[0], width)
    }
}

function inkColour(card, shape, paper) {
    const darkest = [...shape]
        .sort((a, b) => inkAt(card, b * Channels, paper) - inkAt(card, a * Channels, paper))
        .slice(0, Math.ceil(shape.length / 2))
    return [0, 1, 2].map((channel) =>
        median(darkest.map((pixel) => card[pixel * Channels + channel]))
    )
}

function spread(shapes, width, reach) {
    const area = new Set()
    for (const pixel of shapes.flat()) {
        const [x, y] = [pixel % width, Math.floor(pixel / width)]
        for (let dy = -reach; dy <= reach; dy++) {
            for (let dx = -reach; dx <= reach; dx++) area.add((y + dy) * width + x + dx)
        }
    }
    return area
}

// Paints out the letter to the end of its soft edge, stopping short of the ink around it.
function eraseLetter(card, width, shape, others, paper) {
    const kept = spread(others, width, 2)
    for (const pixel of spread([shape], width, 5)) {
        if (!kept.has(pixel)) paintPaper(card, pixel * Channels, paper)
    }
}

function letterMark({ top, bottom, centreX }, rank) {
    const { path: outline, left, right, width } = letters[rank]
    const height = bottom - top + 1
    const scaleY = height / capHeight
    const scaleX = (width * height) / letterHeight / (right - left)
    const x = centreX + 0.5 - (scaleX * (right - left)) / 2 - left * scaleX
    return { outline, transform: `translate(${x} ${bottom + 1}) scale(${scaleX} ${scaleY})` }
}

// Swaps the four corner letters of a Tarot Nouveau court card for the English ones.
async function replaceLetters(card, width, height, paper, id) {
    const rank = id.split('-')[1]
    const marks = []
    let working = card
    for (const turned of [false, true]) {
        for (const side of ['left', 'right']) {
            const { shape, others, bounds } = findLetter(working, width, height, paper, side, id)
            const ink = inkColour(working, shape, paper)
            eraseLetter(working, width, shape, others, paper)
            marks.push({ ...letterMark(bounds, rank), ink, turned })
        }
        working = halfTurn(working, Channels)
    }
    const drawn = marks
        .map(({ outline, transform, ink, turned }) => {
            const turn = turned ? `rotate(180 ${width / 2} ${height / 2}) ` : ''
            return `<path d="${outline}" transform="${turn}${transform}" fill="rgb(${ink.join(',')})"/>`
        })
        .join('')
    const overlay = await sharp(
        Buffer.from(`<svg width="${width}" height="${height}">${drawn}</svg>`)
    )
        .blur(0.6)
        .png()
        .toBuffer()
    return sharp(working, { raw: { width, height, channels: Channels } })
        .composite([{ input: overlay }])
        .removeAlpha()
        .raw()
        .toBuffer()
}

async function prepare(raw, id, pack) {
    const { width, height, paper } = pack
    let card = raw
    balancePaper(card, paper)
    settlePaper(card, paper)
    if (pack === Classic) {
        clearBorder(card, width, height, paper, width - 32, height - 32, 30)
    } else if (isPip(id)) {
        clearBorder(card, width, height, paper, width - 40, height - 40, 30)
    } else {
        const number = trumpNumber(id)
        const [frameWidth, frameHeight] =
            number !== undefined && number <= 21 ? TarotFrames.Trump : TarotFrames.Face
        clearBorder(card, width, height, paper, frameWidth + 8, frameHeight + 8, 36)
    }
    if (isPip(id)) clearSpecks(card, width, height, paper)
    if (pack === Tarot && isCourt(id)) card = await replaceLetters(card, width, height, paper, id)
    if (pack === Classic && id === 'trump-2') card = halfTurn(card, Channels)
    return card
}

async function scanOf(pack, page) {
    const file = path.join(materials, pack.folder, `2026-11-06-${page}.jpg`)
    const { data, info } = await sharp(file)
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true })
    return { data, width: info.width, height: info.height }
}

// The Industrie und Glück's printed back, which both packs use. It shares a page with its last
// trumps.
async function classicBack() {
    const { width, height, paper } = Classic
    const scan = await scanOf(Classic, '0024')
    const card = cut(scan, placements['industrie-and-gluck/back'], width, height)
    balancePaper(card, paper)
    settlePaper(card, paper)
    clearBorder(card, width, height, paper, width - 32, height - 32, 30)
    return card
}

async function allCards(pack) {
    const cards = new Map()
    for (const [page, ids] of Object.entries(pack.pages)) {
        const scan = await scanOf(pack, page)
        const placed = placements[`${pack.folder}/${page}`]
        if (placed.length !== ids.length) {
            throw new Error(`Page ${page} has ${placed.length} cards, expected ${ids.length}`)
        }
        for (const [index, id] of ids.entries()) {
            if (id === null) continue
            const raw = cut(scan, placed[index], pack.width, pack.height)
            cards.set(id, await prepare(raw, id, pack))
        }
    }
    return cards
}

// Each pip on a pip card, large enough not to be an index.
function pipsOf(card, { width, height, paper }) {
    return inkShapes(card, width, height, paper, 60)
        .filter((shape) => shape.length > 2500)
        .map((shape) => boundsOf(shape, width))
}

// Guards the page tables: an Industrie und Glück pip card shows as many pips as its rank.
function checkPipCounts(cards) {
    for (const [id, card] of cards) {
        if (!isPip(id)) continue
        const shown = pipsOf(card, Classic).length
        if (shown !== Number(id.split('-')[1])) throw new Error(`${id} shows ${shown} pips`)
    }
}

// The red 1's pip lifted off its paper, standing the way the black pips stand when upright.
function pipSprite(redOne, redSuit) {
    const { width, height, paper } = Classic
    const shape = inkShapes(redOne, width, height, paper, 60).sort((a, b) => b.length - a.length)[0]
    const bounds = boundsOf(shape, width)
    const Margin = 4
    const [left, top] = [bounds.left - Margin, bounds.top - Margin]
    const spriteWidth = bounds.right - bounds.left + 1 + 2 * Margin
    const spriteHeight = bounds.bottom - bounds.top + 1 + 2 * Margin
    const ink = inkColour(redOne, shape, paper)
    const sprite = Buffer.alloc(spriteWidth * spriteHeight * 4)
    for (let y = 0; y < spriteHeight; y++) {
        for (let x = 0; x < spriteWidth; x++) {
            const source = ((top + y) * width + left + x) * Channels
            const target = (y * spriteWidth + x) * 4
            const reach = inkAt(redOne, source, paper) / inkAt(Buffer.from(ink), 0, paper)
            ink.forEach((value, channel) => (sprite[target + channel] = value))
            sprite[target + 3] = Math.round(255 * Math.min(1, Math.max(0, reach)))
        }
    }
    // A heart's weight sits above its middle when upright; a diamond has no way up.
    const inverted = redSuit === 'hearts' && bounds.massY > bounds.centreY
    return {
        upright: inverted ? halfTurn(sprite, 4) : sprite,
        flipped: inverted ? sprite : halfTurn(sprite, 4),
        width: spriteWidth,
        height: spriteHeight
    }
}

async function composedRedPips(cards) {
    const { width, height, paper } = Classic
    const faces = new Map()
    const blank = Buffer.alloc(width * height * Channels)
    for (let offset = 0; offset < blank.length; offset += Channels) paintPaper(blank, offset, paper)
    for (const redSuit of ['hearts', 'diamonds']) {
        const sprite = pipSprite(cards.get(`${redSuit}-1`), redSuit)
        for (const rank of ['10', '9', '8', '7']) {
            // A spade's weight sits below its middle when upright.
            const pips = pipsOf(cards.get(`spades-${rank}`), Classic).map((pip) => ({
                input: pip.massY > pip.centreY ? sprite.upright : sprite.flipped,
                raw: { width: sprite.width, height: sprite.height, channels: 4 },
                left: Math.round(pip.centreX - sprite.width / 2),
                top: Math.round(pip.centreY - sprite.height / 2)
            }))
            const face = await sharp(blank, { raw: { width, height, channels: Channels } })
                .composite(pips)
                .removeAlpha()
                .raw()
                .toBuffer()
            faces.set(`${redSuit}-${rank}`, face)
        }
    }
    return faces
}

async function writeFace(card, pack, file) {
    const { width, height, outputWidth } = pack
    const radius = Math.round(outputWidth * CornerShare)
    const corners = Buffer.from(
        `<svg width="${outputWidth}" height="${OutputHeight}"><rect width="${outputWidth}" height="${OutputHeight}" rx="${radius}" ry="${radius}" fill="#fff"/></svg>`
    )
    await sharp(card, { raw: { width, height, channels: Channels } })
        .resize(outputWidth, OutputHeight, { fit: 'fill', kernel: 'lanczos3' })
        .ensureAlpha()
        .composite([{ input: corners, blend: 'dest-in' }])
        .webp({ quality: 86, alphaQuality: 100 })
        .toFile(file)
}

// The faces in the order the game's generated tables list them.
function faceIds() {
    const ids = trumps(1, 22)
    for (const name of ['hearts', 'diamonds', 'clubs', 'spades']) {
        const pips =
            name === 'hearts' || name === 'diamonds' ? ['1', '2', '3', '4'] : ['10', '9', '8', '7']
        ids.push(...suit(name, 'K', 'Q', 'C', 'J', ...pips))
    }
    return ids
}

const RedPipIds = ['hearts', 'diamonds'].flatMap((name) => suit(name, '10', '9', '8', '7'))

async function writePack({
    pack,
    folder,
    generated,
    origin,
    faces,
    redPips,
    facesName,
    redPipsName,
    back
}) {
    const out = path.join(images, folder)
    rmSync(out, { recursive: true, force: true })
    mkdirSync(out, { recursive: true })
    const lines = [`// Generated by scripts/import-cards.mjs from ${origin}; do not edit.`, '']
    const entries = []
    for (const [index, id] of faceIds().entries()) {
        await writeFace(faces.get(id), pack, path.join(out, `${id}.webp`))
        lines.push(`import card${index} from './${folder}/${id}.webp'`)
        entries.push(`    '${id}': card${index}`)
    }
    const redEntries = []
    for (const id of RedPipIds) {
        const name = `uniform${id.replace('-', '')}`
        await writeFace(redPips.get(id), pack, path.join(out, `${id}.webp`))
        lines.push(`import ${name} from './${folder}/${id}.webp'`)
        redEntries.push(`    '${id}': ${name}`)
    }
    if (back) {
        await writeFace(back, pack, path.join(out, 'back.webp'))
        lines.push(`import cardBack from './${folder}/back.webp'`)
    }
    lines.push(
        '',
        ...(back ? ['export const ClassicCardBack: string = cardBack', ''] : []),
        `export const ${facesName}: Readonly<Record<string, string>> = {`,
        entries.join(',\n'),
        '}',
        '',
        '// The red 10 9 8 7 for the "Red 10–7" card style, keyed by the pip they show.',
        `export const ${redPipsName}: Readonly<Record<string, string>> = {`,
        redEntries.join(',\n'),
        '}',
        ''
    )
    writeFileSync(path.join(images, generated), lines.join('\n'))
}

// The cover: the Trull fanned on green baize.
async function writeCover() {
    const trull = ['trump-1', 'trump-22', 'trump-21']
    const fanned = await Promise.all(
        trull.map(async (id, index) => {
            const input = await sharp(path.join(images, 'cards', `${id}.webp`))
                .resize({ height: 270 })
                .rotate((index - 1) * 14, { background: '#00000000' })
                .png()
                .toBuffer()
            const { width, height } = await sharp(input).metadata()
            const centreX = 250 + (index - 1) * 110
            const centreY = index === 1 ? 190 : 210
            return {
                input,
                left: Math.round(centreX - width / 2),
                top: Math.round(centreY - height / 2)
            }
        })
    )
    await sharp({ create: { width: 500, height: 400, channels: 4, background: '#245a39' } })
        .composite(fanned)
        .webp({ quality: 86 })
        .toFile(path.join(images, 'cover.webp'))
}

const tarot = await allCards(Tarot)
await writePack({
    pack: Tarot,
    folder: 'cards',
    generated: 'cards.generated.ts',
    origin: 'the Tarot Nouveau scans',
    faces: tarot,
    redPips: tarot,
    facesName: 'CardArt',
    redPipsName: 'UniformRedPipArt'
})

const classic = await allCards(Classic)
checkPipCounts(classic)
await writePack({
    pack: Classic,
    folder: 'classic',
    generated: 'classicCards.generated.ts',
    origin: 'the Industrie und Glück scans',
    faces: classic,
    redPips: await composedRedPips(classic),
    facesName: 'ClassicCardArt',
    redPipsName: 'ClassicUniformRedPipArt',
    back: await classicBack()
})

await writeCover()
console.log(`Wrote ${tarot.size} Tarot Nouveau and ${classic.size} Industrie und Glück cards`)
