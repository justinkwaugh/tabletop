import { PieceKind } from '@tabletop/tzaar'
import { PIECE_MODEL, RISE, TILT, type PieceModel } from './pieceGeometry.js'
import { metalOf, SURFACE_STYLES, type Surface, type Tone } from './pieceStyle.js'

// A TZAAR piece is a GIPF piece with a sunken middle: a thick plastic disc with a straight side,
// its corners a little rounded, and a flat top. Set in from the edge a groove runs round, its
// walls sloping straight down to a flat floor; inside it a flat ring stands level with the edge,
// and inside the ring the centre is sunk, its edge rounded down to a flat floor. A Tzarra's
// sunken centre is metal, gold on white and silver on black; a Tzaar's groove is metal too. A
// Tott is plain.
//
// The side is drawn as a lathe: thin slices from the base up, each a flattened circle of the
// side's radius at its height, painted bottom first so each slice leaves only its front edge
// showing. The top is drawn as bands from the edge inward, each at its height, shaded by which
// way it faces: the far half of every band first, outer to inner, so a lower band further in
// shows where it is nearer you; then the near half, inner to outer, so a higher band further out
// hides a lower one behind it.

// The rounding of the side's corners, as a fraction of the thickness.
const CORNER = 0.12
// Distances from the centre, as fractions of the radius: where the groove's outer wall starts
// down, its floor, and where its inner wall comes up; where the sunken centre's rounded edge
// starts down, and its floor.
const GROOVE = { outerTop: 0.84, outerFloor: 0.79, innerFloor: 0.71, innerTop: 0.66 }
const CENTRE = { top: 0.38, floor: 0.3 }
// Depths, as fractions of the thickness.
const GROOVE_DEPTH = 0.3
const CENTRE_DEPTH = 0.32
// Slices through each rounded corner of the side and through its straight middle.
const CORNER_SLICES = 3
const MIDDLE_SLICES = 2
// How strongly a slope shows in the shading, and how much darker the deepest hollow is, as
// GIPF's trough is: in the shade of the edges round it.
const SLOPE_GAIN = 1.6
const HOLLOW_SHADE = 0.45

// How many shades a surface can take, from facing straight away to facing straight at you.
export const SHADE_LEVELS = 13

export type Ellipse = { y: number; rx: number; ry: number }
export type Slice = Ellipse & { level: number }
// A band of the top between two distances from the centre: the ellipse at its outer edge, whose
// far side shows, and the near half of the band itself; each with its shade.
export type Band = {
    outer: Ellipse
    near: string
    farLevel: number
    nearLevel: number
    // The middle of the band, from the centre, for choosing its material.
    middle: number
}

// One piece standing on its underside, drawn from its base.
export type PieceDrawing = {
    side: Slice[]
    top: Band[]
    // The top's outline, where the side's rounded corner meets it: on a covered piece, the
    // crease under the next.
    face: Ellipse
    // How far up the screen the top is at a distance from the centre.
    surface: (distance: number) => number
    height: number
}

function level(facing: number): number {
    const clamped = Math.max(-1, Math.min(1, facing))
    return Math.round(((clamped + 1) / 2) * (SHADE_LEVELS - 1))
}

// The side's radius and how it faces at a height up it, all over the piece's radius.
function sideProfile(height: number, thickness: number): { radius: number; facing: number } {
    const round = CORNER * thickness
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

// The top's height at a distance from the centre, all over the piece's radius.
export function topProfile(distance: number, model: PieceModel = PIECE_MODEL): number {
    const { thickness } = model
    const between = (from: number, to: number) => (distance - from) / (to - from)
    if (distance <= CENTRE.floor) return thickness * (1 - CENTRE_DEPTH)
    if (distance < CENTRE.top) {
        const along = between(CENTRE.top, CENTRE.floor)
        return thickness * (1 - (CENTRE_DEPTH * (1 - Math.cos(Math.PI * along))) / 2)
    }
    if (distance <= GROOVE.innerTop || distance >= GROOVE.outerTop) return thickness
    if (distance < GROOVE.innerFloor) {
        return thickness * (1 - GROOVE_DEPTH * between(GROOVE.innerTop, GROOVE.innerFloor))
    }
    if (distance <= GROOVE.outerFloor) return thickness * (1 - GROOVE_DEPTH)
    return thickness * (1 - GROOVE_DEPTH * between(GROOVE.outerTop, GROOVE.outerFloor))
}

// Which parts of the top are metal.
export function isMetal(kind: PieceKind, distance: number): boolean {
    const inCentre = distance < CENTRE.top
    const inGroove = distance > GROOVE.innerTop && distance < GROOVE.outerTop
    if (kind === PieceKind.Tzaar) return inCentre || inGroove
    return kind === PieceKind.Tzarra && inCentre
}

// The surface each band of the top is made of.
export function bandSurface(tone: Tone, kind: PieceKind, band: Band): Surface {
    return isMetal(kind, band.middle) ? metalOf(tone) : tone
}

// The distances bounding the top's bands, from the edge inward: one band across each flat, more
// across each slope and the rounded edge.
function bandEdges(faceEdge: number): number[] {
    const span = (from: number, to: number, count: number) =>
        Array.from({ length: count }, (_, index) => from + ((to - from) * index) / count)
    return [
        ...span(faceEdge, GROOVE.outerTop, 1),
        ...span(GROOVE.outerTop, GROOVE.outerFloor, 3),
        ...span(GROOVE.outerFloor, GROOVE.innerFloor, 1),
        ...span(GROOVE.innerFloor, GROOVE.innerTop, 3),
        ...span(GROOVE.innerTop, CENTRE.top, 1),
        ...span(CENTRE.top, CENTRE.floor, 8),
        CENTRE.floor,
        0
    ]
}

export function pieceDrawing(radius: number, model: PieceModel = PIECE_MODEL): PieceDrawing {
    const { thickness } = model
    const at = (height: number, r: number): Ellipse => ({
        y: -height * radius * RISE,
        rx: r * radius,
        ry: r * radius * TILT
    })
    const span = (from: number, to: number, count: number) =>
        Array.from({ length: count }, (_, index) => from + ((to - from) * index) / count)
    const round = CORNER * thickness
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

    const faceEdge = 1 - round
    const edges = bandEdges(faceEdge)
    const top = edges.slice(0, -1).map((outer, index) => {
        const inner = edges[index + 1]
        const outerHeight = topProfile(outer, model)
        const innerHeight = topProfile(inner, model)
        // Rising outward, a band faces you on the far side and away on the near side.
        const slope = (outerHeight - innerHeight) / (outer - inner)
        const facing = (SLOPE_GAIN * slope) / Math.sqrt(1 + slope ** 2)
        const depth = (thickness - (outerHeight + innerHeight) / 2) / thickness
        const shade = (HOLLOW_SHADE * depth) / Math.max(GROOVE_DEPTH, CENTRE_DEPTH)
        return {
            outer: at(outerHeight, outer),
            near: nearHalf(at(outerHeight, outer), at(innerHeight, inner)),
            farLevel: level(facing - shade),
            nearLevel: level(-facing - shade),
            middle: (outer + inner) / 2
        }
    })

    return {
        side,
        top,
        face: at(thickness, faceEdge),
        surface: (distance) => -topProfile(distance, model) * radius * RISE,
        height: thickness * radius * RISE
    }
}

// The near half of a band, between its outer and inner edges, each at its own height.
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

// Whether a point of the top, at (x, y) over the radius from the centre (y toward you), can be
// seen: no part of the top nearer you along the same line stands up into the line of sight.
export function isSeen(x: number, y: number, model: PieceModel = PIECE_MODEL): boolean {
    const height = topProfile(Math.hypot(x, y), model)
    const edge = Math.sqrt(Math.max(0, 1 - x * x))
    for (let step = 1; step <= 24; step++) {
        const nearer = y + ((edge - y) * step) / 24
        const rise = (topProfile(Math.hypot(x, nearer), model) - height) * RISE
        if (rise > (nearer - y) * TILT + 1e-4) return false
    }
    return true
}

// How steeply the top slopes at a distance from the centre, as height over distance.
export function slopeAt(distance: number, model: PieceModel = PIECE_MODEL): number {
    const step = 0.004
    return Math.abs(
        (topProfile(distance + step, model) - topProfile(Math.max(0, distance - step), model)) /
            (2 * step)
    )
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
    const toward = (index: 0 | 1 | 2) => from[index] + (to[index] - from[index]) * amount
    return [toward(0), toward(1), toward(2)]
}

function css(color: Rgb, brightness = 1): string {
    const [r, g, b] = color.map((value) => Math.round(Math.min(255, value * brightness)))
    return `rgb(${r} ${g} ${b})`
}

function facingOf(shade: number): number {
    return (shade / (SHADE_LEVELS - 1)) * 2 - 1
}

// A surface's color as it faces: toward the bevel color facing you, the edge color facing away.
function shaded(surface: Surface, facing: number): Rgb {
    const style = SURFACE_STYLES[surface]
    return facing >= 0
        ? mix(rgb(style.face), rgb(style.bevel), facing * 0.85)
        : mix(rgb(style.face), rgb(style.edge), -facing * 0.7)
}

// The stops across a side slice, left to right, as GIPF's and LYNGK's: rounded away from the
// light at either edge.
export function sideStops(surface: Surface, shade: number): { offset: number; color: string }[] {
    const style = SURFACE_STYLES[surface]
    const light = 0.55 + 0.45 * facingOf(shade)
    const base = mix(rgb(style.edge), rgb(style.face), Math.min(1, Math.max(0, light)))
    return [
        { offset: 0, color: css(base, 0.75) },
        { offset: 0.32, color: css(base, 1.06) },
        { offset: 1, color: css(base, 0.62) }
    ]
}

// Down a band's outer ellipse, far edge to middle: the far side faces one way, the sides across.
export function farStops(surface: Surface, shade: number): { offset: number; color: string }[] {
    return [
        { offset: 0, color: css(shaded(surface, facingOf(shade))) },
        { offset: 0.5, color: css(shaded(surface, 0)) }
    ]
}

// Down a band's near half, middle to near edge.
export function nearStops(surface: Surface, shade: number): { offset: number; color: string }[] {
    return [
        { offset: 0, color: css(shaded(surface, 0)) },
        { offset: 1, color: css(shaded(surface, facingOf(shade))) }
    ]
}

// The top of a covered piece, in the shadow of the piece resting on it, as GIPF's and LYNGK's.
export function creaseColor(tone: Tone): string {
    return css(mix(rgb(SURFACE_STYLES[tone].edge), [0, 0, 0], 0.35))
}

// Where a mark lies on a stack's top piece, relative to the piece's underside: a ring on the flat
// edge between the side and the groove.
export function markRing(radius: number, model: PieceModel = PIECE_MODEL): Ellipse {
    const distance = (GROOVE.outerTop + 1 - CORNER * model.thickness) / 2
    return {
        y: -model.thickness * radius * RISE,
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
