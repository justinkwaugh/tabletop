// Cuts a parrotfish out of the painted water around it, so the player panel can set it over its
// own sea. Needs ImageMagick (`convert`, `identify`).
import { execFileSync } from 'node:child_process'

// The water and the reef silhouettes in it are teal and at most 33% saturated; the fish's own teal
// (the yellow fish's tail, the purple fish's head) is at least 40%.
const WaterHue = [150, 200]
const WaterMaxSaturation = 0.37
const WaterMaxValue = 0.8
const Margin = 4

function isWater(data, pixel) {
    const r = data[pixel * 4] / 255
    const g = data[pixel * 4 + 1] / 255
    const b = data[pixel * 4 + 2] / 255
    const max = Math.max(r, g, b)
    const delta = max - Math.min(r, g, b)
    if (max === 0 || delta === 0) {
        return false
    }
    const sector =
        max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4
    const hue = (sector * 60 + 360) % 360
    return (
        hue >= WaterHue[0] &&
        hue <= WaterHue[1] &&
        delta / max < WaterMaxSaturation &&
        max < WaterMaxValue
    )
}

function neighbours(pixel, width, height) {
    const x = pixel % width
    const y = Math.floor(pixel / width)
    return [
        x > 0 ? pixel - 1 : -1,
        x < width - 1 ? pixel + 1 : -1,
        y > 0 ? pixel - width : -1,
        y < height - 1 ? pixel + width : -1
    ].filter((neighbour) => neighbour >= 0)
}

// Water reachable from the image's edges.
function floodWater(data, width, height) {
    const water = new Uint8Array(width * height)
    const stack = []
    for (let x = 0; x < width; x++) {
        stack.push(x, (height - 1) * width + x)
    }
    for (let y = 0; y < height; y++) {
        stack.push(y * width, y * width + width - 1)
    }
    while (stack.length > 0) {
        const pixel = stack.pop()
        if (water[pixel] || !isWater(data, pixel)) {
            continue
        }
        water[pixel] = 1
        stack.push(...neighbours(pixel, width, height))
    }
    return water
}

// The largest connected piece that is not water: the fish, without stray specks of other fish.
function largestPiece(water, width, height) {
    const piece = new Int32Array(width * height).fill(-1)
    let largest = -1
    let largestSize = 0
    let count = 0
    for (let start = 0; start < width * height; start++) {
        if (water[start] || piece[start] >= 0) {
            continue
        }
        let size = 0
        const stack = [start]
        piece[start] = count
        while (stack.length > 0) {
            const pixel = stack.pop()
            size++
            for (const neighbour of neighbours(pixel, width, height)) {
                if (!water[neighbour] && piece[neighbour] < 0) {
                    piece[neighbour] = count
                    stack.push(neighbour)
                }
            }
        }
        if (size > largestSize) {
            largestSize = size
            largest = count
        }
        count++
    }
    return Uint8Array.from(piece, (id) => (id === largest ? 1 : 0))
}

export function cutOutWater(file, webpOptions) {
    const [width, height] = execFileSync('identify', ['-format', '%w %h', file])
        .toString()
        .split(' ')
        .map(Number)
    const data = Buffer.from(execFileSync('convert', [file, '-depth', '8', 'rgba:-']))
    const fish = largestPiece(floodWater(data, width, height), width, height)

    let left = width
    let top = height
    let right = 0
    let bottom = 0
    for (let pixel = 0; pixel < width * height; pixel++) {
        const x = pixel % width
        const y = Math.floor(pixel / width)
        // A one-pixel soft edge: the share of the fish in each fish pixel's 3 by 3 neighbourhood.
        let inside = 0
        let total = 0
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (x + dx >= 0 && x + dx < width && y + dy >= 0 && y + dy < height) {
                    inside += fish[pixel + dy * width + dx]
                    total++
                }
            }
        }
        data[pixel * 4 + 3] = fish[pixel] ? Math.round((255 * inside) / total) : 0
        if (fish[pixel]) {
            left = Math.min(left, x)
            right = Math.max(right, x)
            top = Math.min(top, y)
            bottom = Math.max(bottom, y)
        }
    }
    left = Math.max(0, left - Margin)
    top = Math.max(0, top - Margin)
    right = Math.min(width - 1, right + Margin)
    bottom = Math.min(height - 1, bottom + Margin)

    execFileSync(
        'convert',
        [
            ['-size', `${width}x${height}`, '-depth', '8', 'rgba:-'],
            ['-crop', `${right - left + 1}x${bottom - top + 1}+${left}+${top}`, '+repage'],
            webpOptions,
            ['-define', 'webp:alpha-quality=100'],
            file
        ].flat(),
        { input: data }
    )
}
