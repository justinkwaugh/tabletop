import { PIECE_MODEL, RISE, TILT, type PieceModel } from './pieceGeometry.js'
import { PIECE_STYLES, type Tone } from './pieceStyle.js'

// A DVONN piece is a thin plastic donut with a straight outer side and a dished top: the outer
// rim and the hole's edge stand at the same height, and from each the top curves down to a flat
// floor in the middle. The underside has the opposite shape, bulging down, so the pieces nest: a
// piece on the board stands on its bulge with its edges raised, and a piece on another sits in
// its dish, a little above it. The corners are a little rounded.
//
// The piece is drawn as a lathe: thin slices of its side from the base up, each a flattened
// circle of the profile's radius at its height, painted bottom first so each slice leaves only
// its front edge showing; then the top as rings from the rim inward, each a flattened circle at
// its height, so each leaves a band of the top showing. A ring's band is shaded by which way it
// faces: on the far side a surface rising outward faces you, on the near side it faces away.

// Fractions of the piece's thickness: the softening of the side's corners and of the hole's
// edge, and how deep the dish is.
const EDGE_ROUND = 0.22
const LIP_ROUND = 0.15
export const DISH_DEPTH = 0.3
// The dish's flat floor, as a share of the width between the hole's edge and the rim.
const FLOOR_SHARE = 0.35
// Slices through each softened corner of the side, and through its straight middle; and rings
// across the dish and round into the hole.
const CORNER_SLICES = 3
const MIDDLE_SLICES = 2
const DISH_SLICES = 24
const LIP_SLICES = 2
// How strongly a slope shows in the shading.
const SLOPE_GAIN = 2.2

// How many shades a slice can take, from facing straight away to facing straight at you.
export const SHADE_LEVELS = 9

export type Ellipse = { y: number; rx: number; ry: number }
export type Slice = Ellipse & { level: number }

// One piece standing on its underside, drawn from its base.
export type PieceDrawing = {
    side: Slice[]
    // The top, from the rim in; each slice's level is how its far side faces, its near side
    // facing the opposite way.
    top: Slice[]
    // Where the side's softened corner meets the top: on a covered piece, the crease under the
    // next.
    rim: Ellipse
    // The hole's narrowest openings, below its rounded top edge and above its bottom one.
    opening: Ellipse
    bottomOpening: Ellipse
    // How far up the screen the top surface is at a distance from the centre.
    surface: (distance: number) => number
    height: number
}

function level(facing: number): number {
    const clamped = Math.max(-1, Math.min(1, facing))
    return Math.round(((clamped + 1) / 2) * (SHADE_LEVELS - 1))
}

// The side's radius and how it faces at a height up it, all over the piece's radius.
export function sideProfile(height: number, thickness: number): { radius: number; facing: number } {
    const round = EDGE_ROUND * thickness
    if (height < round) {
        const from = round - height
        return {
            radius: 1 - round + Math.sqrt(Math.max(0, round ** 2 - from ** 2)),
            facing: -from / round
        }
    }
    const rimStart = thickness - round
    if (height > rimStart) {
        const into = height - rimStart
        return {
            radius: 1 - round + Math.sqrt(Math.max(0, round ** 2 - into ** 2)),
            facing: into / round
        }
    }
    return { radius: 1, facing: 0 }
}

// How far down the dish is at a distance from the centre, from 0 at the edges to 1 on the floor:
// from each edge it curves down, steepest at the edge, and levels out onto the floor.
export function dish(distance: number, model: PieceModel = PIECE_MODEL): number {
    const rimIn = 1 - EDGE_ROUND * model.thickness
    const lipOut = model.hole + LIP_ROUND * model.thickness
    if (distance <= lipOut || distance >= rimIn) return 0
    const curve = ((rimIn - lipOut) * (1 - FLOOR_SHARE)) / 2
    const fromEdge = Math.min(distance - lipOut, rimIn - distance)
    const along = Math.min(1, fromEdge / curve)
    return 1 - (1 - along) ** 2
}

// The top's height at a distance from the centre, all over the piece's radius.
export function topProfile(distance: number, model: PieceModel = PIECE_MODEL): number {
    const { thickness, hole } = model
    const lip = LIP_ROUND * thickness
    const lipOut = hole + lip
    if (distance >= lipOut) return thickness - DISH_DEPTH * thickness * dish(distance, model)
    const into = Math.max(0, lipOut - distance)
    return thickness - lip + Math.sqrt(Math.max(0, lip ** 2 - into ** 2))
}

// The underside's height at a distance from the centre, below the edges' undersides: the bulge
// stands `rise` below them, so a piece on the board stands that far up on it. The hole's bottom
// edge is rounded as its top edge is.
export function undersideProfile(distance: number, model: PieceModel = PIECE_MODEL): number {
    const lip = LIP_ROUND * model.thickness
    const lipOut = model.hole + lip
    if (distance >= lipOut) return -model.rise * dish(distance, model)
    const into = Math.max(0, lipOut - distance)
    return lip - Math.sqrt(Math.max(0, lip ** 2 - into ** 2))
}

export function pieceDrawing(radius: number, model: PieceModel = PIECE_MODEL): PieceDrawing {
    const { thickness, hole } = model
    const at = (height: number, r: number): Ellipse => ({
        y: -height * radius * RISE,
        rx: r * radius,
        ry: r * radius * TILT
    })
    const span = (from: number, to: number, count: number) =>
        Array.from({ length: count }, (_, index) => from + ((to - from) * index) / count)
    const round = EDGE_ROUND * thickness
    const heights = [
        ...span(0, round, CORNER_SLICES),
        ...span(round, thickness - round, MIDDLE_SLICES),
        ...span(thickness - round, thickness, CORNER_SLICES),
        thickness
    ]
    const side = heights.map((height) => {
        const { radius: r, facing } = sideProfile(height, thickness)
        return { ...at(height, r), level: level(facing) }
    })

    const rimIn = 1 - round
    const lipOut = hole + LIP_ROUND * thickness
    const distances = [...span(rimIn, lipOut, DISH_SLICES), ...span(lipOut, hole, LIP_SLICES)]
    const top = distances.map((distance, index) => {
        // Each slice stands for the band from its edge in to the next slice's edge.
        const inner = distances[index + 1] ?? hole
        const slope = (topProfile(distance, model) - topProfile(inner, model)) / (distance - inner)
        const facing = (SLOPE_GAIN * slope) / Math.sqrt(1 + slope ** 2)
        return { ...at(topProfile(distance, model), distance), level: level(facing) }
    })

    return {
        side,
        top,
        rim: at(thickness, rimIn),
        opening: at(thickness - LIP_ROUND * thickness, hole),
        bottomOpening: at(LIP_ROUND * thickness, hole),
        surface: (distance) => -topProfile(distance, model) * radius * RISE,
        height: thickness * radius * RISE
    }
}

// The far wall seen inside an upper opening down to a lower one of the same size: the part of
// the upper opening above the lower one's far edge.
export function wallBand(upper: Ellipse, lower: Ellipse): string {
    const { rx, ry } = upper
    const depth = lower.y - upper.y
    if (depth >= 2 * ry) return ellipsePath(upper)
    const x = rx * Math.sqrt(1 - (depth / (2 * ry)) ** 2)
    const y = upper.y + depth / 2
    return `M ${-x} ${y} A ${rx} ${ry} 0 1 1 ${x} ${y} A ${rx} ${ry} 0 0 0 ${-x} ${y} Z`
}

// Where the board shows through a hole from its upper opening down to its lower one: their
// overlap, a lens between the points where they cross; nothing once the hole is too deep.
export function lens(upper: Ellipse, lower: Ellipse): string | undefined {
    const { rx, ry } = upper
    const depth = lower.y - upper.y
    if (depth >= 2 * ry) return undefined
    const x = rx * Math.sqrt(1 - (depth / (2 * ry)) ** 2)
    const y = upper.y + depth / 2
    return `M ${-x} ${y} A ${rx} ${ry} 0 0 0 ${x} ${y} A ${rx} ${ry} 0 0 0 ${-x} ${y} Z`
}

export function ellipsePath({ y, rx, ry }: Ellipse): string {
    return `M ${-rx} ${y} A ${rx} ${ry} 0 1 0 ${rx} ${y} A ${rx} ${ry} 0 1 0 ${-rx} ${y} Z`
}

// The front half of a thinned piece's side: a band from its underside up.
export function bandPath(base: number, side: number, radius: number): string {
    const r = radius
    const ry = radius * TILT
    return `M ${-r} ${base - side} L ${-r} ${base} A ${r} ${ry} 0 0 0 ${r} ${base} L ${r} ${base - side} A ${r} ${ry} 0 0 1 ${-r} ${base - side} Z`
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

function facingOf(shade: number): number {
    return (shade / (SHADE_LEVELS - 1)) * 2 - 1
}

// A surface's color as it faces: toward the lit color facing you, the shaded one facing away.
function shaded(tone: Tone, facing: number): Rgb {
    const style = PIECE_STYLES[tone]
    return facing >= 0
        ? mix(rgb(style.face), rgb(style.bevel), facing * 0.85)
        : mix(rgb(style.face), rgb(style.edge), -facing * 0.7)
}

// The stops across a side slice, left to right: rounded away from the light at either edge,
// gently, as YINSH's are, so the white pieces stay white.
export function sideStops(tone: Tone, shade: number): { offset: number; color: string }[] {
    const facing = facingOf(shade)
    const style = PIECE_STYLES[tone]
    const light = 0.55 + 0.45 * facing
    const base = mix(rgb(style.edge), rgb(style.face), Math.min(1, Math.max(0, light)))
    return [
        { offset: 0, color: css(base, 0.9) },
        { offset: 0.32, color: css(base, 1.03) },
        { offset: 1, color: css(base, 0.8) }
    ]
}

// The stops down a top slice, far edge to near edge: the far side faces one way, the near side
// the other.
export function topStops(tone: Tone, shade: number): { offset: number; color: string }[] {
    const facing = facingOf(shade)
    return [
        { offset: 0, color: css(shaded(tone, facing)) },
        { offset: 0.5, color: css(shaded(tone, 0)) },
        { offset: 1, color: css(shaded(tone, -facing)) }
    ]
}

// The top of a covered piece, in the shadow of the piece resting on it.
export function creaseColor(tone: Tone): string {
    return css(mix(rgb(PIECE_STYLES[tone].edge), [0, 0, 0], 0.35))
}

// Where a mark lies on a stack's top piece, relative to the piece's underside: a ring just
// inside the rim, at the top's height there.
export function markRing(radius: number, model: PieceModel = PIECE_MODEL): Ellipse {
    const distance = 1 - EDGE_ROUND * model.thickness - 0.04
    return {
        y: -topProfile(distance, model) * radius * RISE,
        rx: distance * radius,
        ry: distance * radius * TILT
    }
}

// A stack's outline on screen, from the underside of its bottom piece to its top piece's rim:
// the near half of the one, the far half of the other, joined by the sides.
export function outlinePath(base: number, top: number, radius: number): string {
    const ry = radius * TILT
    return `M ${-radius} ${top} A ${radius} ${ry} 0 0 1 ${radius} ${top} L ${radius} ${base} A ${radius} ${ry} 0 0 1 ${-radius} ${base} Z`
}
