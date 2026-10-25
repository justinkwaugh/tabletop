import type { BoardView } from './geometry.js'

// YINSH's pieces as the published ones are, seen from the near side of the table.
//
// A ring is a flat band with a large hole: straight sides and a flat top, only lightly rounded
// at the edges. It is drawn as a lathe: thin slices of its outer side from the base up, each a
// flattened circle of the profile's radius at its height, painted bottom first so each slice
// leaves only its front edge showing; then the flat top, the hole's rounded edge, and through
// the hole the far inner wall with the board showing below it. A marker is a thin disc of blue
// with a white face on one side and a black one on the other, each set a little down inside a
// lip of the blue.

export type Ellipse = { y: number; rx: number; ry: number }
// A slice of a side at a shade level.
export type Slice = Ellipse & { level: number }

// How many shades a slice can take, from facing straight down to facing straight up.
export const SHADE_LEVELS = 9

// The ring's proportions, as fractions of its outer radius.
export const RING_HOLE = 0.72
export const RING_THICKNESS = 0.24
const RING_TOP_ROUND = RING_THICKNESS * 0.14
const RING_BASE_ROUND = RING_THICKNESS * 0.1
const RING_SLICES = 12

// The marker's, as fractions of its radius; its edges' rounding and how far each face sits down
// inside the blue lip as fractions of its thickness, which matches the ring's.
const MARKER_ROUND = 0.12
export const MARKER_FACE = 0.86
const MARKER_RECESS = 0.16
const MARKER_SLICES = 8

export type RingDrawing = {
    slices: Slice[]
    // The silhouette: the base and the top joined by straight sides.
    outline: string
    // The flat top, with the opening of its rounded inner edge cut out.
    top: string
    // The rounded inner edge, from the flat top down into the hole.
    innerEdge: string
    // The far side of the hole's wall, facing you, and the board showing through below it.
    farWall: string
    // The far inner wall's span on screen at the hole's middle: its top and bottom.
    wall: { top: number; bottom: number }
    // Where the board shows through: the overlap of the hole's top and bottom openings. Every
    // filled part of the ring carries it, for `fill-rule: evenodd`.
    through: string
    // Where the far half of the ring ends on screen: below it, the ring stands in front of a
    // marker sitting in its hole.
    nearFrom: number
    height: number
}

export type MarkerDrawing = {
    slices: Slice[]
    outline: string
    lip: Ellipse
    // The opening in the lip, where the face sits down: the lip's inner wall on the far side,
    // and the face, as much of it as the near side of the lip leaves showing.
    opening: Ellipse
    face: string
    // The lip's far inner wall, from the face up to the lip, and its span at the middle.
    innerWall: string
    wall: { top: number; bottom: number }
    height: number
}

function ellipsePath({ y, rx, ry }: Ellipse): string {
    return `M ${-rx} ${y} A ${rx} ${ry} 0 1 0 ${rx} ${y} A ${rx} ${ry} 0 1 0 ${-rx} ${y} Z`
}

// A flattened circle at the base and the same at the top, joined by their sides.
function silhouette(base: Ellipse, top: Ellipse): string {
    const { rx, ry } = base
    return `M ${-rx} ${top.y} A ${rx} ${ry} 0 0 1 ${rx} ${top.y} L ${rx} ${base.y} A ${rx} ${ry} 0 0 1 ${-rx} ${base.y} Z`
}

function level(facing: number): number {
    return Math.round(((facing + 1) / 2) * (SHADE_LEVELS - 1))
}

// Radius and upward slope of a side with rounded edges, at a height up it: `base` and `top` are
// the radii of its rounding at the bottom and top, all over the piece's radius.
function profile(
    height: number,
    thickness: number,
    base: number,
    top: number
): { radius: number; facing: number } {
    if (height < base) {
        const from = base - height
        return {
            radius: 1 - base + Math.sqrt(Math.max(0, base ** 2 - from ** 2)),
            facing: -from / base
        }
    }
    const topStart = thickness - top
    if (height > topStart) {
        const into = height - topStart
        return {
            radius: 1 - top + Math.sqrt(Math.max(0, top ** 2 - into ** 2)),
            facing: into / top
        }
    }
    return { radius: 1, facing: 0 }
}

function sideSlices(
    view: BoardView,
    radius: number,
    count: number,
    thickness: number,
    base: number,
    top: number
): Slice[] {
    return Array.from({ length: count + 1 }, (_, index) => {
        const height = (thickness * index) / count
        const { radius: r, facing } = profile(height, thickness, base, top)
        return {
            y: -view.height(height * radius),
            rx: r * radius,
            ry: r * radius * view.tilt,
            level: level(facing)
        }
    })
}

// The overlap of two openings of the same size, one above the other: a lens between the points
// where they cross.
function lens(upper: Ellipse, lower: Ellipse): string {
    const { rx, ry } = upper
    const gap = lower.y - upper.y
    const x = rx * Math.sqrt(Math.max(0, 1 - (gap / (2 * ry)) ** 2))
    const mid = (upper.y + lower.y) / 2
    return `M ${-x} ${mid} A ${rx} ${ry} 0 0 0 ${x} ${mid} A ${rx} ${ry} 0 0 0 ${-x} ${mid} Z`
}

export function ringDrawing(view: BoardView, radius: number): RingDrawing {
    const at = (height: number, r: number): Ellipse => ({
        y: -view.height(height * radius),
        rx: r * radius,
        ry: r * radius * view.tilt
    })
    // The hole is straight between its rounded edges; its narrowest openings bound what shows
    // through.
    const upper = at(RING_THICKNESS - RING_TOP_ROUND, RING_HOLE)
    const lower = at(RING_BASE_ROUND, RING_HOLE)
    const through = lens(upper, lower)
    const topOpening = at(RING_THICKNESS, RING_HOLE + RING_TOP_ROUND)
    return {
        slices: sideSlices(
            view,
            radius,
            RING_SLICES,
            RING_THICKNESS,
            RING_BASE_ROUND,
            RING_TOP_ROUND
        ),
        outline: silhouette(at(0, 1), at(RING_THICKNESS, 1)),
        top: `${ellipsePath(at(RING_THICKNESS, 1 - RING_TOP_ROUND))} ${ellipsePath(topOpening)}`,
        innerEdge: `${ellipsePath(topOpening)} ${ellipsePath(upper)}`,
        farWall: `${ellipsePath(upper)} ${through}`,
        wall: { top: upper.y, bottom: lower.y },
        through,
        nearFrom: (upper.y + lower.y) / 2,
        height: view.height(RING_THICKNESS * radius)
    }
}

export function markerDrawing(view: BoardView, radius: number, height: number): MarkerDrawing {
    const thickness = height / radius
    const round = thickness * MARKER_ROUND
    const at = (height: number, r: number): Ellipse => ({
        y: -view.height(height * radius),
        rx: r * radius,
        ry: r * radius * view.tilt
    })
    return {
        slices: sideSlices(view, radius, MARKER_SLICES, thickness, round, round),
        outline: silhouette(at(0, 1), at(thickness, 1)),
        lip: at(thickness, 1 - round),
        opening: at(thickness, MARKER_FACE),
        face: lens(at(thickness, MARKER_FACE), at(thickness * (1 - MARKER_RECESS), MARKER_FACE)),
        innerWall: `${ellipsePath(at(thickness, MARKER_FACE))} ${lens(
            at(thickness, MARKER_FACE),
            at(thickness * (1 - MARKER_RECESS), MARKER_FACE)
        )}`,
        wall: {
            top: at(thickness, MARKER_FACE).y,
            bottom: at(thickness * (1 - MARKER_RECESS), MARKER_FACE).y
        },
        height: view.height(height)
    }
}

export { ellipsePath }

type Rgb = [number, number, number]

export type Material = 'white' | 'black' | 'blue'

// Each material's side, lit and in shadow. The white rings are a cool white, as the
// published ones are.
const PALETTE: Record<Material, { lit: Rgb; shaded: Rgb }> = {
    white: { lit: [240, 242, 247], shaded: [120, 124, 138] },
    black: { lit: [62, 63, 68], shaded: [0, 0, 0] },
    blue: { lit: [52, 98, 196], shaded: [10, 26, 70] }
}

function mix(from: Rgb, to: Rgb, amount: number): Rgb {
    return from.map((value, index) => value + (to[index] - value) * amount) as Rgb
}

function css(rgb: Rgb, brightness = 1): string {
    const [r, g, b] = rgb.map((value) => Math.round(Math.min(255, value * brightness)))
    return `rgb(${r} ${g} ${b})`
}

// The stops across a slice, left to right: rounded away from the light at either edge.
export function sideStops(material: Material, shade: number): { offset: number; color: string }[] {
    const { lit, shaded } = PALETTE[material]
    const facing = (shade / (SHADE_LEVELS - 1)) * 2 - 1
    const light = 0.55 + 0.45 * facing
    const base = mix(shaded, lit, Math.min(1, Math.max(0, light)))
    return [
        { offset: 0, color: css(base, 0.9) },
        { offset: 0.32, color: css(base, 1.03) },
        { offset: 1, color: css(base, 0.8) }
    ]
}
