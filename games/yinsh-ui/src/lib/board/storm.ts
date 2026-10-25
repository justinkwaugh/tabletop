import { seededRandom } from './random.js'

// A storm of cloud wound around the middle of the board, as on the original printing: thousands
// of faint streaks traced along a wind that circles an eye and draws in towards it, brightest in
// a few spiral bands. Large enough to run on under the whole table, in board units centred on the
// board; the board and the table both show it as a still image.
//
// Tracing the streaks takes seconds, far too long to do as a game opens, so the images are
// rendered ahead of time by scripts/render-storm.mjs into $lib/images and imported from
// stormImages.ts. After changing anything here, run `pnpm run render-storm` in games/yinsh-ui.
export const STORM_SIZE = 2400
// Rendered at a lower resolution than board units: the streaks are soft, and it keeps the
// images small.
export const STORM_RESOLUTION = 0.6

const EYE = 40
// The bands are strongest near the board and settle to a steady haze further out.
const REACH = 900
const OUTER_HAZE = 0.45
const PULL = 0.28
const ARMS = 3
const WIND = 0.45
const STREAKS = 46000
const EDDIES = 12
const STEP = 2

type Gust = (x: number, y: number) => number

function makeGust(random: () => number): Gust {
    const waves = Array.from({ length: 4 }, () => ({
        fx: (random() - 0.5) * 0.015,
        fy: (random() - 0.5) * 0.015,
        phase: random() * Math.PI * 2
    }))
    return (x, y) =>
        waves.reduce((sum, w) => sum + Math.sin(x * w.fx + y * w.fy + w.phase), 0) / waves.length
}

type Eddy = { x: number; y: number; spin: number; size: number }

// Smaller whirls caught up in the storm, turning either way, away from the eye.
function makeEddies(random: () => number): Eddy[] {
    return Array.from({ length: EDDIES }, () => {
        const angle = random() * Math.PI * 2
        const distance = 220 + random() * 520
        return {
            x: Math.cos(angle) * distance,
            y: Math.sin(angle) * distance,
            spin: (random() < 0.5 ? -1 : 1) * (0.6 + random() * 0.6),
            size: 110 + random() * 130
        }
    })
}

function direction(x: number, y: number, gust: Gust, eddies: readonly Eddy[]): [number, number] {
    const r = Math.hypot(x, y) + 1e-6
    let vx = -y / r - (PULL * x) / r + 0.45 * gust(x, y)
    let vy = x / r - (PULL * y) / r + 0.45 * gust(y, x)
    for (const eddy of eddies) {
        const dx = x - eddy.x
        const dy = y - eddy.y
        const d = Math.hypot(dx, dy) + 1e-6
        const force = eddy.spin * Math.exp(-((d / eddy.size) ** 2))
        vx += (-dy / d) * force
        vy += (dx / d) * force
    }
    const length = Math.hypot(vx, vy)
    return [vx / length, vy / length]
}

function bandStrength(x: number, y: number, gust: Gust): number {
    const r = Math.hypot(x, y)
    const phase = Math.atan2(y, x) + WIND * 4 * Math.log(r / EYE + 1)
    const arm = 0.5 + 0.5 * Math.cos(ARMS * phase + 2 * gust(x * 0.7, y * 0.7))
    const envelope =
        Math.min(1, Math.max(0, (r - EYE) / 60)) *
        (OUTER_HAZE + (1 - OUTER_HAZE) * Math.max(0, 1 - (r / REACH) ** 2))
    // Uneven: the bands break up into brighter and fainter patches.
    const patch = 0.45 + 0.55 * Math.max(0, gust(x * 2.3 + 300, y * 2.3 - 170) + 0.4)
    return (0.3 + 0.7 * arm ** 1.2) * envelope * patch
}

export type StormTone = { color: string; strength: number }

// White streaks for the table around the board, faint grey ones for the board itself. Both
// trace the same streaks, so the storm runs on across the board's edge.
export const TABLE_STORM: StormTone = { color: '232 238 246', strength: 0.375 }
export const BOARD_STORM: StormTone = { color: '96 112 140', strength: 0.13 }

// Draws the storm on a canvas STORM_SIZE × STORM_RESOLUTION pixels square.
export function drawStorm(context: CanvasRenderingContext2D, tone: StormTone) {
    context.scale(STORM_RESOLUTION, STORM_RESOLUTION)
    const random = seededRandom(5)
    const gust = makeGust(random)
    const eddies = makeEddies(random)
    const half = STORM_SIZE / 2
    context.lineCap = 'round'
    for (let i = 0; i < STREAKS; i++) {
        let x = (random() - 0.5) * STORM_SIZE
        let y = (random() - 0.5) * STORM_SIZE
        const band = bandStrength(x, y, gust)
        const alpha = (0.03 + random() * 0.14) * band * tone.strength
        const width = 0.8 + random() * random() * 5
        const length = 40 + random() * 220
        if (band < 0.03) continue
        context.strokeStyle = `rgb(${tone.color} / ${alpha})`
        context.lineWidth = width
        context.beginPath()
        context.moveTo(x + half, y + half)
        for (let travelled = 0; travelled < length; travelled += STEP) {
            const [dx, dy] = direction(x, y, gust, eddies)
            x += dx * STEP
            y += dy * STEP
            if (Math.hypot(x, y) < EYE) break
            context.lineTo(x + half, y + half)
        }
        context.stroke()
    }
}
