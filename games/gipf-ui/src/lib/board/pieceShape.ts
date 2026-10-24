import type { BoardView } from './geometry.js'

// A GIPF piece, as the published ones are: a thin plastic disc with rounded edges and a flat
// top, with a circular trough set in from the edge. A ring on the underside fits the trough of
// the piece below, so a GIPF-piece is two of them sitting flush.
//
// The disc is drawn as a lathe: thin slices from the base up, each a flattened circle of the
// profile's radius at its height, painted bottom first so each slice leaves only its front edge
// showing. A slice's shade follows the way its surface faces, darker where it turns under.

export type Tone = 'light' | 'dark'

// All as fractions of the piece's radius.
export const THICKNESS = 0.36
const BASE_ROUND = THICKNESS * 0.25
const RIM_ROUND = THICKNESS * 0.3
// The upper disc of a GIPF-piece rests on its underside ring, a little above the lower disc, so a
// dark crease shows between them: the lower disc's top, in the upper disc's shadow.
const STACK_GAP = THICKNESS * 0.14
const TROUGH_OUTER = 0.76
const TROUGH_INNER = 0.57
const TROUGH_DEPTH = THICKNESS * 0.3
const SLICES = 12
const TOP_RADIUS = 1 - RIM_ROUND * 0.6

// How many shades a slice can take, from facing straight down to facing straight up.
export const SHADE_LEVELS = 9

// A slice of the side at a shade level.
export type Slice = { y: number; rx: number; ry: number; level: number }
export type Ellipse = { y: number; rx: number; ry: number }
// One disc standing on its point.
export type DiscDrawing = {
    slices: Slice[]
    top: Ellipse
    // The trough's opening, where its floor shows; the outer wall on the far side, facing you;
    // the wall of the centre on the near side; and the centre itself, level with the edge.
    trough: Ellipse
    farWall: string
    nearWall: string
    centre: Ellipse
}
export type PieceDrawing = {
    disc: DiscDrawing
    // How far up the screen each disc stands, from the bottom up.
    bases: number[]
    // The top of a disc with another on it, in that one's shadow, where the crease shows.
    crease: Ellipse
}

// Radius and upward slope of the disc's side at a height up it, all over its radius.
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

// Where each disc of a stack stands, from the bottom up, as heights over the radius.
function discBases(discs: number): number[] {
    return Array.from({ length: discs }, (_, index) => index * (THICKNESS + STACK_GAP))
}

export function discsOf(gipf: boolean): number {
    return gipf ? 2 : 1
}

export function stackTop(discs: number): number {
    return discBases(discs).at(-1)! + THICKNESS
}

export function pieceTop(gipf: boolean): number {
    return stackTop(discsOf(gipf))
}

// A stack of discs of the given radius standing on its point, at the view's tilt: the same disc at
// each base, each drawn from its own base. A piece is one disc, a GIPF-piece two.
export function pieceDrawing(view: BoardView, discs: number, radius: number): PieceDrawing {
    const ellipse = (height: number, r: number): Ellipse => ({
        y: -view.height(height * radius),
        rx: r * radius,
        ry: r * radius * view.tilt
    })
    const slices = Array.from({ length: SLICES + 1 }, (_, index) => {
        const height = (THICKNESS * index) / SLICES
        const { radius: r, facing } = profile(height)
        return { ...ellipse(height, r), level: level(facing) }
    })
    const depth = view.height(TROUGH_DEPTH * radius)
    const trough = ellipse(THICKNESS, TROUGH_OUTER)
    const centre = ellipse(THICKNESS, TROUGH_INNER)
    return {
        disc: {
            slices,
            top: ellipse(THICKNESS, TOP_RADIUS),
            trough,
            farWall: farWall(trough, depth),
            nearWall: nearWall(centre, depth),
            centre
        },
        bases: discBases(discs).map((base) => -view.height(base * radius)),
        crease: ellipse(THICKNESS, TOP_RADIUS)
    }
}

// The part of the opening above the trough's floor, between the points where the opening and the
// floor's outer edge, lower by the depth, cross.
function farWall({ y, rx, ry }: Ellipse, depth: number): string {
    const x = rx * Math.sqrt(1 - (depth / (2 * ry)) ** 2)
    const mid = y + depth / 2
    return `M ${-x} ${mid} A ${rx} ${ry} 0 1 1 ${x} ${mid} A ${rx} ${ry} 0 0 0 ${-x} ${mid} Z`
}

// The centre's edge, from its rim down to the trough's floor, round the front.
function nearWall({ y, rx, ry }: Ellipse, depth: number): string {
    const bottom = y + depth
    return `M ${-rx} ${y} L ${-rx} ${bottom} A ${rx} ${ry} 0 0 0 ${rx} ${bottom} L ${rx} ${y} Z`
}

type Rgb = [number, number, number]

const PALETTE: Record<Tone, { lit: Rgb; shaded: Rgb }> = {
    light: { lit: [236, 229, 204], shaded: [120, 111, 86] },
    dark: { lit: [70, 65, 66], shaded: [0, 0, 0] }
}

function mix(from: Rgb, to: Rgb, amount: number): Rgb {
    return from.map((value, index) => value + (to[index] - value) * amount) as Rgb
}

function css(rgb: Rgb, brightness = 1): string {
    const [r, g, b] = rgb.map((value) => Math.round(Math.min(255, value * brightness)))
    return `rgb(${r} ${g} ${b})`
}

// The stops across a slice, left to right: rounded away from the light at either edge.
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
