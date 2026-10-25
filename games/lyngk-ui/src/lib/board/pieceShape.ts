import type { PieceColor } from '@tabletop/lyngk'
import type { BoardView } from './geometry.js'
import { THICKNESS } from './pieceGeometry.js'
import { PIECE_STYLES } from './pieceStyle.js'

// A LYNGK piece is a GIPF piece in another color: a thin plastic disc with rounded edges and a
// flat top, with a circular trough set in from the edge. A ring on the underside fits the trough
// of the piece below, so stacked pieces sit flush but for a slight rise.
//
// The disc is drawn as a lathe: thin slices from the base up, each a flattened circle of the
// profile's radius at its height, painted bottom first so each slice leaves only its front edge
// showing. A slice's shade follows the way its surface faces, darker where it turns under.

// All as fractions of the piece's radius.
const BASE_ROUND = THICKNESS * 0.25
const RIM_ROUND = THICKNESS * 0.3
const TROUGH_OUTER = 0.76
const TROUGH_INNER = 0.57
const TROUGH_DEPTH = THICKNESS * 0.3
const SLICES = 12
export const TOP_RADIUS = 1 - RIM_ROUND * 0.6

// How many shades a slice can take, from facing straight down to facing straight up.
export const SHADE_LEVELS = 9

export type Slice = { y: number; rx: number; ry: number; level: number }
export type Ellipse = { y: number; rx: number; ry: number }
// One disc standing on its point, drawn from its base.
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

export function discDrawing(view: BoardView, radius: number): DiscDrawing {
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
        slices,
        top: ellipse(THICKNESS, TOP_RADIUS),
        trough,
        farWall: farWall(trough, depth),
        nearWall: nearWall(centre, depth),
        centre
    }
}

// The part of the opening above the trough's floor, between the points where the opening and
// the floor's outer edge, lower by the depth, cross.
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

function rgb(hex: string): Rgb {
    const value = Number.parseInt(hex.slice(1), 16)
    return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

function mix(from: Rgb, to: Rgb, amount: number): Rgb {
    return from.map((value, index) => value + (to[index] - value) * amount) as Rgb
}

function css(color: Rgb, brightness = 1): string {
    const [r, g, b] = color.map((value) => Math.round(Math.min(255, value * brightness)))
    return `rgb(${r} ${g} ${b})`
}

// Each color lit by its face color and shaded by its edge color.
function tones(color: PieceColor) {
    const style = PIECE_STYLES[color]
    return { lit: rgb(style.face), shaded: rgb(style.edge), style }
}

// The stops across a slice, left to right: rounded away from the light at either edge.
export function sideStops(color: PieceColor, shade: number): { offset: number; color: string }[] {
    const { lit, shaded } = tones(color)
    const facing = (shade / (SHADE_LEVELS - 1)) * 2 - 1
    const light = 0.55 + 0.45 * facing
    const base = mix(shaded, lit, Math.min(1, Math.max(0, light)))
    return [
        { offset: 0, color: css(base, 0.75) },
        { offset: 0.32, color: css(base, 1.06) },
        { offset: 1, color: css(base, 0.62) }
    ]
}

// The top is flat: one gentle fall-off, so the centre and the edge round it read as level.
export function faceStops(color: PieceColor): { offset: number; color: string }[] {
    const { lit } = tones(color)
    return [
        { offset: 0, color: css(lit, 1.04) },
        { offset: 1, color: css(lit, 0.96) }
    ]
}

// The trough's floor and its far wall, shaded as GIPF's are, the centre's near wall catching the light, and the
// crease, the top of a disc in the shadow of the one on it.
export function troughColors(color: PieceColor) {
    const { lit, shaded, style } = tones(color)
    return {
        floor: css(mix(lit, shaded, 0.25)),
        farWall: css(mix(lit, shaded, 0.48)),
        nearWall: css(mix(lit, rgb(style.bevel), 0.4)),
        crease: css(mix(shaded, [0, 0, 0], 0.35))
    }
}
