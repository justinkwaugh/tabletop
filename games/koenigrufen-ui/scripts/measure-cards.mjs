// Finds where each card lies on the scanned pages and writes scripts/card-placements.json, which
// scripts/import-cards.mjs cuts the faces by. Every card is a rigid rectangle: a centre and a small
// rotation in full-scale scan pixels, listed in reading order per page.
//
// The two packs need different evidence. The Industrie und Glück's cream paper separates from the
// scanner lid by hue, so its cards are fitted to the lid around them. The Tarot Nouveau's paper and
// lid are the same colour on many pages, so its cards are found by their ink, which is symmetric
// under a half turn: the printed frame where there is one, otherwise the four corner indices.
//
//   node scripts/measure-cards.mjs ../../my-materials/koenigrufen
import { readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { TarotFrames } from './card-frames.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const [materials] = process.argv.slice(2)
if (!materials) throw new Error('Usage: node scripts/measure-cards.mjs <materials folder>')

// The scans are analysed at half scale.
const Scale = 2

const TarotNouveau = {
    folder: 'tarot-nouveau',
    // Pages not listed lay out two rows of three.
    grids: { '0004': [2, 2], '0007': [2, 2], '0014': [2, 2] },
    // Trumps fill 0001 to 0003 and the first three of 0004; the framed pages after them are faces.
    framedPages: 7
}
const IndustrieUndGlueck = {
    folder: 'industrie-and-gluck',
    grids: { '0016': [2, 2], '0019': [2, 2] },
    // The lid shows a little bluer than this; the paper is well below it.
    lidBlueOverRed: -1,
    cardSize: [744.5, 1345],
    // The third column of this page holds only the card back, which is not a face.
    skip: { '0024': [2, 5] },
    back: { page: '0024', seed: { x: 1999, y: 1387 } }
}

async function halfScale(file) {
    const { width } = await sharp(file).metadata()
    const { data, info } = await sharp(file)
        .removeAlpha()
        .resize({ width: Math.round(width / Scale), kernel: 'cubic' })
        .raw()
        .toBuffer({ resolveWithObject: true })
    return { data, width: info.width, height: info.height }
}

function neighbours(pixel, width, size) {
    const x = pixel % width
    return [
        x > 0 ? pixel - 1 : -1,
        x < width - 1 ? pixel + 1 : -1,
        pixel >= width ? pixel - width : -1,
        pixel + width < size ? pixel + width : -1
    ]
}

// Keeps the connected shapes of at least `minArea` pixels. A hairline is the shadow of a card's
// edge, not ink, on pages whose cards have no printed frame.
function keepShapes(mask, width, height, minArea, dropHairlines) {
    const size = width * height
    const seen = new Uint8Array(size)
    const kept = new Uint8Array(size)
    const stack = new Int32Array(size)
    for (let start = 0; start < size; start++) {
        if (!mask[start] || seen[start]) continue
        const shape = []
        let depth = 0
        stack[depth++] = start
        seen[start] = 1
        while (depth > 0) {
            const pixel = stack[--depth]
            shape.push(pixel)
            for (const next of neighbours(pixel, width, size)) {
                if (next >= 0 && mask[next] && !seen[next]) {
                    seen[next] = 1
                    stack[depth++] = next
                }
            }
        }
        let [left, right, top, bottom] = [width, 0, height, 0]
        for (const pixel of shape) {
            const [x, y] = [pixel % width, Math.floor(pixel / width)]
            left = Math.min(left, x)
            right = Math.max(right, x)
            top = Math.min(top, y)
            bottom = Math.max(bottom, y)
        }
        const [spanX, spanY] = [right - left + 1, bottom - top + 1]
        const hairline = Math.max(spanX, spanY) > 8 * Math.min(spanX, spanY)
        if (shape.length >= minArea && !(dropHairlines && hairline)) {
            for (const pixel of shape) kept[pixel] = 1
        }
    }
    return kept
}

// The emptiest line near each even division of `profile`, at the middle of its empty run.
function cuts(profile, parts, low, high) {
    const window = ((high - low) / parts) * 0.3
    const ink = (index) => {
        let sum = 0
        for (let offset = -6; offset <= 6; offset++) sum += profile[index + offset] ?? 0
        return sum
    }
    const found = []
    for (let part = 1; part < parts; part++) {
        const target = low + ((high - low) * part) / parts
        let least = Infinity
        let at = Math.round(target)
        for (let index = Math.round(target - window); index <= target + window; index++) {
            const value = ink(index) + Math.abs(index - target) * 1e-3
            if (value < least) {
                least = value
                at = index
            }
        }
        let [from, to] = [at, at]
        while (ink(from - 1) <= least + 1 && from > target - window - 40) from--
        while (ink(to + 1) <= least + 1 && to < target + window + 40) to++
        found.push(Math.round((from + to) / 2))
    }
    return found
}

function convexHull(points) {
    const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1])
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    const half = (list) => {
        const chain = []
        for (const point of list) {
            while (
                chain.length > 1 &&
                cross(chain[chain.length - 2], chain[chain.length - 1], point) <= 0
            ) {
                chain.pop()
            }
            chain.push(point)
        }
        return chain.slice(0, -1)
    }
    return [...half(sorted), ...half(sorted.reverse())]
}

// The smallest rectangle around `points`, as near upright as the scans lie.
function tightestRectangle(points) {
    let best
    for (let degrees = -4; degrees <= 4; degrees += 0.02) {
        const angle = (degrees * Math.PI) / 180
        const [cos, sin] = [Math.cos(angle), Math.sin(angle)]
        let [u0, u1, v0, v1] = [Infinity, -Infinity, Infinity, -Infinity]
        for (const [x, y] of points) {
            const [u, v] = [cos * x + sin * y, -sin * x + cos * y]
            u0 = Math.min(u0, u)
            u1 = Math.max(u1, u)
            v0 = Math.min(v0, v)
            v1 = Math.max(v1, v)
        }
        const area = (u1 - u0) * (v1 - v0)
        if (!best || area < best.area) {
            const [u, v] = [(u0 + u1) / 2, (v0 + v1) / 2]
            best = { area, degrees, x: cos * u - sin * v, y: sin * u + cos * v }
        }
    }
    return best
}

// The ink of each card on a Tarot Nouveau page, as a tight rectangle.
function inkRectangles({ data, width, height }, [rows, columns], framed) {
    const dark = new Uint8Array(width * height)
    for (let y = 8; y < height - 8; y++) {
        for (let x = 8; x < width - 8; x++) {
            const offset = (y * width + x) * 3
            const least = Math.min(data[offset], data[offset + 1], data[offset + 2])
            dark[y * width + x] = least < 118 ? 1 : 0
        }
    }
    const ink = keepShapes(dark, width, height, 60, !framed)
    const span = (profile) => {
        let [low, high] = [0, profile.length - 1]
        while (profile[low] === 0) low++
        while (profile[high] === 0) high--
        return [low, high]
    }
    const rowInk = new Float64Array(height)
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) rowInk[y] += ink[y * width + x]
    }
    const [top, bottom] = span(rowInk)
    const rowCuts = [top, ...cuts(rowInk, rows, top, bottom), bottom + 1]
    const rectangles = []
    for (let row = 0; row < rows; row++) {
        const columnInk = new Float64Array(width)
        for (let y = rowCuts[row]; y < rowCuts[row + 1]; y++) {
            for (let x = 0; x < width; x++) columnInk[x] += ink[y * width + x]
        }
        const [left, right] = span(columnInk)
        const columnCuts = [left, ...cuts(columnInk, columns, left, right), right + 1]
        for (let column = 0; column < columns; column++) {
            const points = []
            for (let y = rowCuts[row]; y < rowCuts[row + 1]; y++) {
                for (let x = columnCuts[column]; x < columnCuts[column + 1]; x++) {
                    if (ink[y * width + x]) {
                        points.push([x * Scale, y * Scale], [(x + 1) * Scale, (y + 1) * Scale])
                    }
                }
            }
            rectangles.push(tightestRectangle(convexHull(points)))
        }
    }
    return rectangles
}

// Points along a rectangle's straight sides, away from its corners.
function sidePoints(width, height) {
    const points = []
    const Samples = 90
    for (let index = 0; index <= Samples; index++) {
        const along = -0.42 + (0.84 * index) / Samples
        points.push(
            [along * width, -height / 2, 0, -1],
            [along * width, height / 2, 0, 1],
            [-width / 2, along * height, -1, 0],
            [width / 2, along * height, 1, 0]
        )
    }
    return points
}

function place(x, y, degrees, u, v) {
    const angle = (degrees * Math.PI) / 180
    return [
        x + Math.cos(angle) * u - Math.sin(angle) * v,
        y + Math.sin(angle) * u + Math.cos(angle) * v
    ]
}

// Slides a rectangle of the printed frame's size until its sides lie along dark lines with clean
// paper just outside them, which tells the frame from the picture edges within it. The ink's
// sideways position is sound already; only a faint frame end can leave it short along the card.
function lockToFrame({ data, width, height }, start, [frameWidth, frameHeight]) {
    const luma = new Uint8Array(width * height)
    for (let index = 0; index < width * height; index++) {
        const offset = index * 3
        luma[index] = (data[offset] + data[offset + 1] + data[offset + 2]) / 3
    }
    const lumaAt = (x, y) => luma[Math.round(y / Scale) * width + Math.round(x / Scale)]
    const points = sidePoints(frameWidth, frameHeight)
    const score = (x, y, degrees) => {
        let hits = 0
        for (const [u, v, normalU, normalV] of points) {
            const line = Math.min(
                ...[-2, 0, 2].map((reach) =>
                    lumaAt(...place(x, y, degrees, u + normalU * reach, v + normalV * reach))
                )
            )
            const [outX, outY] = place(x, y, degrees, u + normalU * 9, v + normalV * 9)
            if (line < 190 && lumaAt(outX, outY) > 225) hits++
        }
        return hits / points.length
    }
    let best = { score: -1, ...start }
    for (const [reachX, reachY, step, turn, turnStep] of [
        [8, 56, 4, 1.2, 0.2],
        [4, 4, 1, 0.2, 0.05],
        [1, 1, 0.5, 0.05, 0.01]
    ]) {
        const from = best
        best = { ...from, score: -1 }
        for (let dx = -reachX; dx <= reachX; dx += step) {
            for (let dy = -reachY; dy <= reachY; dy += step) {
                for (let dt = -turn; dt <= turn + 1e-9; dt += turnStep) {
                    const [x, y, degrees] = [from.x + dx, from.y + dy, from.degrees + dt]
                    const value = score(x, y, degrees)
                    if (value > best.score) best = { score: value, x, y, degrees }
                }
            }
        }
    }
    return best
}

// The lid floods in from the page's border; what it cannot reach is card.
function lidFromBorder({ data, width, height }, blueOverRed) {
    const size = width * height
    const open = new Uint8Array(size)
    for (let index = 0; index < size; index++) {
        const [r, g, b] = [data[index * 3], data[index * 3 + 1], data[index * 3 + 2]]
        open[index] = 0.3 * r + 0.59 * g + 0.11 * b > 205 && b - r >= blueOverRed ? 1 : 0
    }
    const lid = new Uint8Array(size)
    const stack = new Int32Array(size)
    let depth = 0
    const flood = (pixel) => {
        if (!lid[pixel]) {
            lid[pixel] = 1
            stack[depth++] = pixel
        }
    }
    for (let x = 0; x < width; x++) {
        for (let y = 0; y < 5; y++) {
            flood(y * width + x)
            flood((height - 1 - y) * width + x)
        }
    }
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < 5; x++) {
            flood(y * width + x)
            flood(y * width + width - 1 - x)
        }
    }
    while (depth > 0) {
        for (const next of neighbours(stack[--depth], width, size)) {
            if (next >= 0 && open[next]) flood(next)
        }
    }
    return lid
}

// Slides a rectangle of the card's size until lid borders it. A stretch touching the next card is
// lid on neither side and counts for nothing, so neighbours cannot pull the fit.
function fitToLid(lid, { width, height }, seed, [cardWidth, cardHeight]) {
    const points = sidePoints(cardWidth, cardHeight)
    const score = (x, y, degrees, reach) => {
        let total = 0
        for (const [u, v, normalU, normalV] of points) {
            const [inX, inY] = place(x, y, degrees, u - normalU * reach, v - normalV * reach)
            const [outX, outY] = place(x, y, degrees, u + normalU * reach, v + normalV * reach)
            const [ix, iy] = [Math.round(inX / Scale), Math.round(inY / Scale)]
            const [ox, oy] = [Math.round(outX / Scale), Math.round(outY / Scale)]
            if (ix < 0 || iy < 0 || ix >= width || iy >= height) {
                total -= 1
                continue
            }
            const outside = ox < 0 || oy < 0 || ox >= width || oy >= height
            total += lid[iy * width + ix] ? -2 : outside || lid[oy * width + ox] ? 1 : 0
        }
        return total / points.length
    }
    let best = { score: -Infinity, ...seed, degrees: 0 }
    for (const [reach, step, turn, turnStep, edge] of [
        [160, 10, 5, 0.5, 8],
        [12, 3, 0.75, 0.15, 6],
        [4, 1, 0.25, 0.05, 4]
    ]) {
        const from = best
        best = { ...from, score: -Infinity }
        for (let dx = -reach; dx <= reach; dx += step) {
            for (let dy = -reach; dy <= reach; dy += step) {
                for (let dt = -turn; dt <= turn + 1e-9; dt += turnStep) {
                    const [x, y, degrees] = [from.x + dx, from.y + dy, from.degrees + dt]
                    const value = score(x, y, degrees, edge)
                    if (value > best.score) best = { score: value, x, y, degrees }
                }
            }
        }
    }
    return best
}

function pagesOf(deck) {
    const folder = path.join(materials, deck.folder)
    return readdirSync(folder)
        .filter((file) => file.endsWith('.jpg'))
        .sort()
        .map((file) => ({ file: path.join(folder, file), page: file.slice(-8, -4) }))
}

const rounded = ({ x, y, degrees, score }) => ({
    x: Math.round(x * 10) / 10,
    y: Math.round(y * 10) / 10,
    degrees: Math.round(degrees * 100) / 100,
    score: Math.round(score * 100) / 100
})

const placements = {}
for (const [index, { file, page }] of pagesOf(TarotNouveau).entries()) {
    const image = await halfScale(file)
    const framed = index < TarotNouveau.framedPages
    const ink = inkRectangles(image, TarotNouveau.grids[page] ?? [2, 3], framed)
    const cards = ink.map((rectangle, card) => {
        if (!framed) return { ...rectangle, score: 1 }
        const isTrump = index < 3 || (index === 3 && card < 3)
        return lockToFrame(image, rectangle, isTrump ? TarotFrames.Trump : TarotFrames.Face)
    })
    placements[`tarot-nouveau/${page}`] = cards.map(rounded)
    console.log(page, cards.map((card) => card.score.toFixed(2)).join(' '))
}
for (const { file, page } of pagesOf(IndustrieUndGlueck)) {
    const image = await halfScale(file)
    const lid = lidFromBorder(image, IndustrieUndGlueck.lidBlueOverRed)
    const [rows, columns] = IndustrieUndGlueck.grids[page] ?? [2, 3]
    const { width: pageWidth } = await sharp(file).metadata()
    const cards = []
    for (let row = 0; row < rows; row++) {
        for (let column = 0; column < columns; column++) {
            if (IndustrieUndGlueck.skip[page]?.includes(row * columns + column)) continue
            const seed = {
                x: ((column + 0.5) * pageWidth) / columns,
                y: ((row + 0.5) * image.height * Scale) / rows
            }
            cards.push(fitToLid(lid, image, seed, IndustrieUndGlueck.cardSize))
        }
    }
    placements[`industrie-and-gluck/${page}`] = cards.map(rounded)
    const { back, cardSize } = IndustrieUndGlueck
    if (page === back.page) {
        placements['industrie-and-gluck/back'] = rounded(fitToLid(lid, image, back.seed, cardSize))
    }
    console.log(page, cards.map((card) => card.score.toFixed(2)).join(' '))
}
writeFileSync(path.join(here, 'card-placements.json'), `${JSON.stringify(placements, null, 4)}\n`)
