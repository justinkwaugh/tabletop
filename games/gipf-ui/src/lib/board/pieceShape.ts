import type { BoardView } from './geometry.js'

// A GIPF piece, as the published ones are, drawn as MATRX GIPF's are: a thin plastic disc with
// rounded edges and a flat top, with a circular groove set in from the edge, its lips rounded down
// to a rounded floor. A ring on the underside fits the groove of the piece below, so a GIPF-piece
// is two of them sitting flush.
//
// The disc is drawn as a lathe: thin slices from the base up, each a flattened circle of the
// profile's radius at its height, painted bottom first so each slice leaves only its front edge
// showing. A slice's shade follows the way its surface faces, darker where it turns under. The
// top is drawn from one height profile as bands from the edge inward, each at its height, shaded
// by which way it faces: the far half of every band first, outer to inner, so a lower band
// further in shows where it is nearer you; then the near half, inner to outer, so a higher band
// further out hides a lower one behind it.
//
// Each tone's disc is pre-rendered to an image by scripts/render-looks.mjs (board/looks.ts).

export type Tone = 'light' | 'dark'

export const TONES: readonly Tone[] = ['light', 'dark']

// All as fractions of the piece's radius.
export const THICKNESS = 0.2826
const BASE_ROUND = THICKNESS * 0.25
const RIM_ROUND = THICKNESS * 0.3
// Each disc rests on its underside ring, a little above the disc below, so a dark crease shows
// between them: the lower disc's top, in the upper disc's shadow. The bottom disc stands on its
// ring as far above the board.
const STACK_GAP = THICKNESS * 0.24
// Distances from the centre where the groove's lips start down, and its depth.
const TROUGH = { outer: 0.84, inner: 0.62 }
const TROUGH_DEPTH = THICKNESS * 0.4
// How much of each side of the groove is its rounded wall; the rest is its floor.
const GROOVE_WALL = 0.42
// Slices up the side, and the side's shades: fine enough that no step shows once the look is
// scaled down.
const SLICES = 48
const TOP_RADIUS = 1 - RIM_ROUND * 0.6
// Bands across the groove: enough that their shades step too finely to see. The seams between so
// many would show as fine lines, but the looks are drawn larger and scaled down, which blends
// them away (scripts/render-looks.mjs).
const GROOVE_BANDS = 60

// How many shades a slice can take, from facing straight down to facing straight up.
export const SHADE_LEVELS = 33

// A slice of the side at a shade level.
export type Slice = { y: number; rx: number; ry: number; level: number }
export type Ellipse = { y: number; rx: number; ry: number }

// A band of the top between two distances from the centre: the ellipse at its outer edge, whose
// far side shows, and the near half of the band itself; its colour, and how steep it is. A steep
// band's wall is shaded on top of its colour, darker towards the far side and lighter towards the
// near side, fading to its colour at either end, so the shade turns smoothly round the ring.
export type Band = { outer: Ellipse; near: string; color: string; steep: number }

export type PieceDrawing = {
    // How far up the screen each disc stands, from the bottom up.
    bases: number[]
    // The top of a disc with another on it, in that one's shadow, where the crease shows.
    crease: Ellipse
}

// The box a single disc's look fills, from its base: the disc, with a little room.
export function lookBox(
    view: BoardView,
    radius: number
): { x: number; y: number; width: number; height: number } {
    const margin = radius * 0.04
    const top = view.height(THICKNESS * radius) + radius * view.tilt + margin
    const bottom = radius * view.tilt + margin
    return { x: -radius - margin, y: -top, width: 2 * (radius + margin), height: top + bottom }
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
    return Array.from({ length: discs }, (_, index) => STACK_GAP + index * (THICKNESS + STACK_GAP))
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

function flatEllipse(view: BoardView, radius: number) {
    return (height: number, r: number): Ellipse => ({
        y: -view.height(height * radius),
        rx: r * radius,
        ry: r * radius * view.tilt
    })
}

// A stack of discs of the given radius standing on its point, at the view's tilt: where each disc
// stands, each drawn from its own base. A piece is one disc, a GIPF-piece two.
export function pieceDrawing(view: BoardView, discs: number, radius: number): PieceDrawing {
    return {
        bases: discBases(discs).map((base) => -view.height(base * radius)),
        crease: flatEllipse(view, radius)(THICKNESS, TOP_RADIUS)
    }
}

// The side's slices, from the base up, for a disc's look.
export function discSlices(view: BoardView, radius: number): Slice[] {
    const ellipse = flatEllipse(view, radius)
    return Array.from({ length: SLICES + 1 }, (_, index) => {
        const height = (THICKNESS * index) / SLICES
        const { radius: r, facing } = profile(height)
        return { ...ellipse(height, r), level: level(facing) }
    })
}

// How deep the groove is at a distance across it: each lip rounds down into a rounded floor,
// level in the middle.
function grooveDepth(distance: number): number {
    const { outer, inner } = TROUGH
    if (distance >= outer || distance <= inner) return 0
    const across = (outer - distance) / (outer - inner)
    const fromLip = Math.min(across, 1 - across) / GROOVE_WALL
    return fromLip >= 1 ? TROUGH_DEPTH : (TROUGH_DEPTH * (1 - Math.cos(Math.PI * fromLip))) / 2
}

// The top's height at a distance from the centre, over the radius.
function topProfile(distance: number): number {
    return THICKNESS - grooveDepth(distance)
}

// The distances bounding the top's bands, from the edge inward: one band across each flat, many
// across the groove.
function bandEdges(): number[] {
    const span = (from: number, to: number, count: number) =>
        Array.from({ length: count }, (_, index) => from + ((to - from) * index) / count)
    return [TOP_RADIUS, ...span(TROUGH.outer, TROUGH.inner, GROOVE_BANDS), TROUGH.inner, 0]
}

// The floor darker than the top, the far wall in shade, the near lip catching the light; steeper
// walls more so.
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
        // Each near half reaches out under the band outside it, which is drawn after it, so no
        // seam shows between them.
        const reach = edges[Math.max(0, index - 1)]
        return {
            outer: ellipse(outerHeight, outer),
            near: nearHalf(ellipse(topProfile(reach), reach), ellipse(innerHeight, inner)),
            color: css(base),
            steep
        }
    })
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

type Rgb = [number, number, number]

const PALETTE: Record<Tone, { lit: Rgb; shaded: Rgb }> = {
    light: { lit: [236, 229, 204], shaded: [120, 111, 86] },
    dark: { lit: [70, 65, 66], shaded: [0, 0, 0] }
}

// The top's colour, and its floor's in the groove.
const TOP_PALETTE: Record<Tone, { flat: Rgb; floor: Rgb }> = {
    light: { flat: [236, 230, 208], floor: [207, 198, 166] },
    dark: { flat: [44, 40, 41], floor: [16, 14, 15] }
}

// The colours the groove's walls are shaded towards, in shade or catching the light.
const WALLS: Record<Tone, { far: Rgb; near: Rgb }> = {
    light: { far: [172, 162, 128], near: [226, 219, 194] },
    dark: { far: [8, 7, 7], near: [74, 68, 70] }
}

function mix(from: Rgb, to: Rgb, amount: number): Rgb {
    return from.map((value, index) => value + (to[index] - value) * amount) as Rgb
}

function css(rgb: Rgb, brightness = 1): string {
    const [r, g, b] = rgb.map((value) => Math.round(Math.min(255, value * brightness)))
    return `rgb(${r} ${g} ${b})`
}

// The walls' colours, for LookDefs' gradients.
export function wallColors(tone: Tone): { far: string; near: string } {
    const { far, near } = WALLS[tone]
    return { far: css(far), near: css(near) }
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
