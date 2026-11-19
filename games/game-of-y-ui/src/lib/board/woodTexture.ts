// The board as a slab of kaya, the wood of fine go boards: on top, straight close grain running
// away from the viewer (masame); down the edge, growth rings wandering top to bottom. Only
// scripts/render-looks.mjs runs this, through the /looks page; rerun it after changing the grain.
import { TILT, type Box } from './geometry.js'
import { clamp, linear, srgb, type Bitmap, type Rgb } from './light.js'
import { seededRandom } from './random.js'

export const WOOD_PIXELS = 1.5

export type Grain = {
    light: string
    mid: string
    dark: string
    // How strongly the fine lines, the broad figure and the fibres show.
    lines: number
    figure: number
    fibre: number
}

export const TOP_GRAIN: Grain = {
    light: '#ebc681',
    mid: '#e0b46b',
    dark: '#c99550',
    lines: 0.45,
    figure: 0.35,
    fibre: 0.25
}

export const EDGE_GRAIN: Grain = {
    light: '#dda55a',
    mid: '#cf9147',
    dark: '#b27433',
    lines: 0.6,
    figure: 0.3,
    fibre: 0.25
}

// Smooth value noise on a lattice, seeded.
function noise2(seed: number): (x: number, y: number) => number {
    const random = seededRandom(seed)
    const size = 256
    const values = Array.from({ length: size * size }, () => random())
    const at = (x: number, y: number) => values[(y & (size - 1)) * size + (x & (size - 1))]
    const fade = (t: number) => t * t * (3 - 2 * t)
    return (x, y) => {
        const x0 = Math.floor(x)
        const y0 = Math.floor(y)
        const fx = fade(x - x0)
        const fy = fade(y - y0)
        const top = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * fx
        const bottom = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * fx
        return top + (bottom - top) * fy
    }
}

function mix(a: Rgb, b: Rgb, t: number): Rgb {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}

// Lines across `across`, each a growth ring: spaced unevenly, some darker than others.
function rings(seed: number) {
    const spacing = noise2(seed)
    const strength = noise2(seed + 1)
    return (across: number, along: number, pitch: number) => {
        const phase = across / pitch + spacing(across * 0.02, along * 0.004) * 6
        const ring = Math.floor(phase)
        const within = phase - ring
        // A sharp late-wood line at the end of each ring, fading back into the early wood.
        const line = Math.exp(-((1 - within) * 9)) + Math.exp(-within * 14) * 0.6
        return line * (0.45 + 0.55 * strength(ring * 0.37, along * 0.003))
    }
}

function paint(box: Box, pixels: number, shade: (x: number, y: number) => number, grain: Grain) {
    const width = Math.ceil(box.width * pixels)
    const rows = Math.ceil(box.height * pixels)
    const data = new Uint8ClampedArray(width * rows * 4)
    const [light, mid, dark]: Rgb[] = [grain.light, grain.mid, grain.dark].map(linear)
    for (let row = 0; row < rows; row++) {
        for (let column = 0; column < width; column++) {
            const value = clamp(shade(box.x + column / pixels, box.y + row / pixels))
            const color =
                value < 0.5 ? mix(light, mid, value * 2) : mix(mid, dark, (value - 0.5) * 2)
            const at = (row * width + column) * 4
            data[at] = srgb(color[0]) * 255
            data[at + 1] = srgb(color[1]) * 255
            data[at + 2] = srgb(color[2]) * 255
            data[at + 3] = 255
        }
    }
    return { x: box.x, y: box.y, width, height: rows, data }
}

// The top seen at the board's tilt, its grain running up the screen.
export function renderTop(box: Box, grain = TOP_GRAIN, pixels = WOOD_PIXELS): Bitmap {
    const ring = rings(7)
    const figure = noise2(19)
    const fibre = noise2(31)
    return paint(
        box,
        pixels,
        (x, screenY) => {
            const y = screenY / TILT
            const drift = (figure(x * 0.01, y * 0.002) - 0.5) * 6
            return (
                0.12 +
                ring(x + drift, y, 4.2) * grain.lines +
                figure(x * 0.006, y * 0.0015) * grain.figure +
                (fibre(x * 0.9, y * 0.03) - 0.5) * grain.fibre
            )
        },
        grain
    )
}

// The edge, its rings wandering from the top down, lit from the left.
export function renderEdge(box: Box, grain = EDGE_GRAIN, pixels = WOOD_PIXELS): Bitmap {
    const ring = rings(43)
    const wander = noise2(53)
    const fibre = noise2(61)
    return paint(
        box,
        pixels,
        (x, y) => {
            const sway =
                (wander(x * 0.004, y * 0.05) - 0.5) * 22 + Math.sin(y * 0.35 + x * 0.01) * 1.2
            return (
                0.18 +
                ring(x + sway, y, 6.5) * grain.lines +
                wander(x * 0.003, 3.7) * grain.figure +
                (fibre(x * 0.8, y * 0.08) - 0.5) * grain.fibre
            )
        },
        grain
    )
}
