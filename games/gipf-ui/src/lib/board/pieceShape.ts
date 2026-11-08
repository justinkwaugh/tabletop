import { piecesIn } from '@tabletop/gipf'
import type { BoardView } from './geometry.js'

// MATRX GIPF's disc, drawn as a lathe of shaded slices under a banded top. The game shows it
// pre-rendered: rerun scripts/render-looks.mjs after changing anything here.

export type Tone = 'light' | 'dark'

export const TONES: readonly Tone[] = ['light', 'dark']

// All as fractions of the piece's radius.
export const THICKNESS = 0.2826
const BASE_ROUND = THICKNESS * 0.25
const RIM_ROUND = THICKNESS * 0.3
const STACK_GAP = THICKNESS * 0.24
const TROUGH = { outer: 0.84, inner: 0.62 }
const TROUGH_DEPTH = THICKNESS * 0.4
const GROOVE_WALL = 0.42
// Fine enough that no step shows once the look is scaled down.
const SLICES = 48
const TOP_RADIUS = 1 - RIM_ROUND * 0.6
// The seams between this many bands blend away as the drawn look is scaled down.
const GROOVE_BANDS = 60

export const SHADE_LEVELS = 33

export type Slice = { y: number; rx: number; ry: number; level: number }
export type Ellipse = { y: number; rx: number; ry: number }

export type Band = { outer: Ellipse; near: string; color: string; steep: number }

export type PieceDrawing = {
    bases: number[]
    crease: Ellipse
}

export function lookBox(
    view: BoardView,
    radius: number
): { x: number; y: number; width: number; height: number } {
    const margin = radius * 0.04
    const top = view.height(THICKNESS * radius) + radius * view.tilt + margin
    const bottom = radius * view.tilt + margin
    return { x: -radius - margin, y: -top, width: 2 * (radius + margin), height: top + bottom }
}

function profile(height: number): { radius: number; facing: number } {
    if (height < BASE_ROUND) {
        const from = BASE_ROUND - height
        return {
            radius: 1 - BASE_ROUND + Math.sqrt(Math.max(0, BASE_ROUND ** 2 - from ** 2)),
            facing: -from / BASE_ROUND
        }
    }
    const rimStart = THICKNESS - RIM_ROUND
    if (height > rimStart) {
        const into = height - rimStart
        return {
            radius: 1 - RIM_ROUND + Math.sqrt(Math.max(0, RIM_ROUND ** 2 - into ** 2)),
            facing: into / RIM_ROUND
        }
    }
    return { radius: 1, facing: 0 }
}

function level(facing: number): number {
    return Math.round(((facing + 1) / 2) * (SHADE_LEVELS - 1))
}

function discBases(discs: number): number[] {
    return Array.from({ length: discs }, (_, index) => STACK_GAP + index * (THICKNESS + STACK_GAP))
}

export function stackTop(discs: number): number {
    return discBases(discs).at(-1)! + THICKNESS
}

export function pieceTop(gipf: boolean): number {
    return stackTop(piecesIn(gipf))
}

function flatEllipse(view: BoardView, radius: number) {
    return (height: number, r: number): Ellipse => ({
        y: -view.height(height * radius),
        rx: r * radius,
        ry: r * radius * view.tilt
    })
}

export function pieceDrawing(view: BoardView, discs: number, radius: number): PieceDrawing {
    return {
        bases: discBases(discs).map((base) => -view.height(base * radius)),
        crease: flatEllipse(view, radius)(THICKNESS, TOP_RADIUS)
    }
}

export function discSlices(view: BoardView, radius: number): Slice[] {
    const ellipse = flatEllipse(view, radius)
    return Array.from({ length: SLICES + 1 }, (_, index) => {
        const height = (THICKNESS * index) / SLICES
        const { radius: r, facing } = profile(height)
        return { ...ellipse(height, r), level: level(facing) }
    })
}

function grooveDepth(distance: number): number {
    const { outer, inner } = TROUGH
    if (distance >= outer || distance <= inner) return 0
    const across = (outer - distance) / (outer - inner)
    const fromLip = Math.min(across, 1 - across) / GROOVE_WALL
    return fromLip >= 1 ? TROUGH_DEPTH : (TROUGH_DEPTH * (1 - Math.cos(Math.PI * fromLip))) / 2
}

function topProfile(distance: number): number {
    return THICKNESS - grooveDepth(distance)
}

function bandEdges(): number[] {
    const span = (from: number, to: number, count: number) =>
        Array.from({ length: count }, (_, index) => from + ((to - from) * index) / count)
    return [TOP_RADIUS, ...span(TROUGH.outer, TROUGH.inner, GROOVE_BANDS), TROUGH.inner, 0]
}

export function topBands(view: BoardView, radius: number, tone: Tone): Band[] {
    const ellipse = flatEllipse(view, radius)
    const edges = bandEdges()
    const { flat, floor } = TOP_PALETTE[tone]
    return edges.slice(0, -1).map((outer, index) => {
        const inner = edges[index + 1]
        const outerHeight = topProfile(outer)
        const innerHeight = topProfile(inner)
        const slope = Math.abs(outerHeight - innerHeight) / (outer - inner)
        const steep = Math.min(1, slope / 0.6)
        const depth = (THICKNESS - (outerHeight + innerHeight) / 2) / TROUGH_DEPTH
        const base = mix(flat, floor, Math.min(1, depth))
        // Each near half reaches under the band outside it, drawn after it, so no seam shows.
        const reach = edges[Math.max(0, index - 1)]
        return {
            outer: ellipse(outerHeight, outer),
            near: nearHalf(ellipse(topProfile(reach), reach), ellipse(innerHeight, inner)),
            color: css(base),
            steep
        }
    })
}

function nearHalf(outer: Ellipse, inner: Ellipse): string {
    return [
        `M ${-outer.rx} ${outer.y}`,
        `A ${outer.rx} ${outer.ry} 0 0 0 ${outer.rx} ${outer.y}`,
        `L ${inner.rx} ${inner.y}`,
        inner.rx > 0
            ? `A ${inner.rx} ${inner.ry} 0 0 1 ${-inner.rx} ${inner.y}`
            : `L ${-inner.rx} ${inner.y}`,
        'Z'
    ].join(' ')
}

type Rgb = [number, number, number]

const PALETTE: Record<Tone, { lit: Rgb; shaded: Rgb }> = {
    light: { lit: [236, 229, 204], shaded: [120, 111, 86] },
    dark: { lit: [70, 65, 66], shaded: [0, 0, 0] }
}

const TOP_PALETTE: Record<Tone, { flat: Rgb; floor: Rgb }> = {
    light: { flat: [236, 230, 208], floor: [207, 198, 166] },
    dark: { flat: [44, 40, 41], floor: [16, 14, 15] }
}

const WALLS: Record<Tone, { far: Rgb; near: Rgb }> = {
    light: { far: [172, 162, 128], near: [226, 219, 194] },
    dark: { far: [8, 7, 7], near: [74, 68, 70] }
}

function mix(from: Rgb, to: Rgb, amount: number): Rgb {
    const channel = (index: number) => from[index] + (to[index] - from[index]) * amount
    return [channel(0), channel(1), channel(2)]
}

function css(rgb: Rgb, brightness = 1): string {
    const [r, g, b] = rgb.map((value) => Math.round(Math.min(255, value * brightness)))
    return `rgb(${r} ${g} ${b})`
}

export function wallColors(tone: Tone): { far: string; near: string } {
    const { far, near } = WALLS[tone]
    return { far: css(far), near: css(near) }
}

export function sideStops(tone: Tone, shade: number): { offset: number; color: string }[] {
    const { lit, shaded } = PALETTE[tone]
    const facing = (shade / (SHADE_LEVELS - 1)) * 2 - 1
    const light = 0.55 + 0.45 * facing
    const base = mix(shaded, lit, Math.min(1, Math.max(0, light)))
    return [
        { offset: 0, color: css(base, 0.75) },
        { offset: 0.32, color: css(base, 1.06) },
        { offset: 1, color: css(base, 0.62) }
    ]
}
