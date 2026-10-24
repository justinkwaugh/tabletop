import { seededRandom } from './random.js'

// The old edition's board: pale sand pressed with a ring where each piece sits. Drawn once on a
// canvas as fine grain over a few soft drifts, and shown as a still image under the spaces.
const RESOLUTION = 1.5
const GRAINS_PER_UNIT = 0.9
const DRIFTS = 40

let cached: { key: string; url: string } | undefined

export function sandImage(width: number, height: number): string | undefined {
    if (typeof document === 'undefined') return undefined
    const key = `${width}x${height}`
    if (cached?.key === key) return cached.url

    const canvas = document.createElement('canvas')
    canvas.width = Math.round(width * RESOLUTION)
    canvas.height = Math.round(height * RESOLUTION)
    const context = canvas.getContext('2d')
    if (!context) return undefined
    const random = seededRandom(1889)
    context.scale(RESOLUTION, RESOLUTION)

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

    cached = { key, url: canvas.toDataURL('image/png') }
    return cached.url
}
