// The old edition's board: pale sand pressed with a ring where each piece sits, drawn as fine
// grain over a few soft drifts. Only scripts/render-sand.mjs runs this, rendering it once to
// src/lib/images/sand.webp; rerun after changing it: pnpm run render-sand
import { seededRandom } from './random.js'

// In board units, a little larger than the board's frame (744 × 328), which the image covers.
export const SAND_SIZE = { width: 760, height: 340 }
export const SAND_RESOLUTION = 1.5
// The sand itself, as --dvonn-sand: the grain is drawn on it, so the image is opaque and
// compresses well.
const SAND = '#d6d1c6'
const GRAINS_PER_UNIT = 0.9
const DRIFTS = 40

export function drawSand(context: CanvasRenderingContext2D) {
    const { width, height } = SAND_SIZE
    const random = seededRandom(1889)
    context.scale(SAND_RESOLUTION, SAND_RESOLUTION)
    context.fillStyle = SAND
    context.fillRect(0, 0, width, height)

    for (let index = 0; index < DRIFTS; index++) {
        const x = random() * width
        const y = random() * height
        const radius = 40 + random() * 120
        const light = random() < 0.5
        const gradient = context.createRadialGradient(x, y, 0, x, y, radius)
        const tint = light ? '255 255 250' : '120 110 95'
        gradient.addColorStop(0, `rgb(${tint} / ${0.05 + random() * 0.05})`)
        gradient.addColorStop(1, `rgb(${tint} / 0)`)
        context.fillStyle = gradient
        context.fillRect(x - radius, y - radius, radius * 2, radius * 2)
    }

    const grains = Math.round(width * height * GRAINS_PER_UNIT)
    for (let index = 0; index < grains; index++) {
        const dark = random() < 0.55
        const alpha = 0.05 + random() * 0.14
        context.fillStyle = dark ? `rgb(90 82 70 / ${alpha})` : `rgb(255 255 252 / ${alpha})`
        const size = 0.35 + random() ** 3 * 0.9
        context.fillRect(random() * width, random() * height, size, size)
    }
}
