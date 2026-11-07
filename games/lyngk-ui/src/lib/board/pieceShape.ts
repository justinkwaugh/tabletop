import { ACTIVE_COLORS, JOKER_COUNT, PieceColor } from '@tabletop/lyngk'
import type { BoardView } from './geometry.js'
import { THICKNESS } from './pieceGeometry.js'
import { PIECE_STYLES } from './pieceStyle.js'

// A LYNGK piece is a GIPF piece in another color, drawn as MATRX GIPF's are: a thin plastic disc
// with rounded edges and a flat top, with a circular groove set in from the edge, its lips rounded
// down to a rounded floor. A ring on the underside fits the groove of the piece below, so stacked
// pieces sit flush but for a slight rise.
//
// The disc is drawn as a lathe: thin slices from the base up, each a flattened circle of the
// profile's radius at its height, painted bottom first so each slice leaves only its front edge
// showing. A slice's shade follows the way its surface faces, darker where it turns under. The
// top is drawn from one height profile as bands from the edge inward, each at its height, shaded
// by which way it faces: the far half of every band first, outer to inner, so a lower band
// further in shows where it is nearer you; then the near half, inner to outer, so a higher band
// further out hides a lower one behind it.
//
// Each color's disc is pre-rendered to an image by scripts/render-looks.mjs; the specks, which
// differ from piece to piece, are drawn over it (StackShape.svelte).

// All as fractions of the piece's radius.
const BASE_ROUND = THICKNESS * 0.25
const RIM_ROUND = THICKNESS * 0.3
// Distances from the centre where the groove's lips start down, and its depth.
const TROUGH = { outer: 0.84, inner: 0.62 }
const TROUGH_DEPTH = THICKNESS * 0.4
// How much of each side of the groove is its rounded wall; the rest is its floor.
const GROOVE_WALL = 0.42
// Slices up the side, and the side's shades: fine enough that no step shows once the look is
// scaled down.
const SLICES = 48
export const TOP_RADIUS = 1 - RIM_ROUND * 0.6
// Bands across the groove: enough that their shades step too finely to see. The seams between so
// many would show as fine lines, but the looks are drawn larger and scaled down, which blends
// them away (scripts/render-looks.mjs).
const GROOVE_BANDS = 60

// The least a speck shrinks to keep off the groove's lips; smaller, it is left out.
const MIN_SPECK_SCALE = 0.4

// How many shades a slice can take, from facing straight down to facing straight up.
export const SHADE_LEVELS = 33

export type Slice = { y: number; rx: number; ry: number; level: number }
export type Ellipse = { y: number; rx: number; ry: number }

// A band of the top between two distances from the centre: the ellipse at its outer edge, whose
// far side shows, and the near half of the band itself; its colour, and how steep it is. A steep
// band's wall is shaded on top of its colour, darker towards the far side and lighter towards the
// near side, fading to its colour at either end, so the shade turns smoothly round the ring.
export type Band = { outer: Ellipse; near: string; color: string; steep: number }

// A disc's look, pre-rendered to a file: a colored piece's plain disc, its few specks drawn over
// it in the game; or one of the three jokers with its many flecks drawn in, seen from the near
// side of the board or the far side.
export type Look = { color: PieceColor; joker?: { number: number; turned: boolean } }

export const LOOKS: readonly Look[] = [
    ...ACTIVE_COLORS.map((color) => ({ color })),
    ...Array.from({ length: JOKER_COUNT }, (_, number) =>
        [false, true].map((turned) => ({ color: PieceColor.Joker, joker: { number, turned } }))
    ).flat()
]

export function lookName(look: Look): string {
    const { joker } = look
    return joker ? `joker-${joker.number}${joker.turned ? '-far' : ''}` : look.color
}

// Each joker's flecks, the same in every game.
export function jokerSeed(number: number): number {
    return 7919 * (number + 1)
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

export function discSlices(view: BoardView, radius: number): Slice[] {
    const ellipse = flatEllipse(view, radius)
    return Array.from({ length: SLICES + 1 }, (_, index) => {
        const height = (THICKNESS * index) / SLICES
        const { radius: r, facing } = profile(height)
        return { ...ellipse(height, r), level: level(facing) }
    })
}

// The disc's outline on screen, from its base: the top edge of its side's slices from left to
// right, and their bottom edge back.
export function discOutline(view: BoardView, radius: number): string {
    const slices = discSlices(view, radius)
    const widest = Math.max(...slices.map((slice) => slice.rx))
    const STEPS = 96
    const xs = Array.from(
        { length: STEPS + 1 },
        (_, step) => -widest * Math.cos((Math.PI * step) / STEPS) * 0.99999
    )
    const edge = (x: number, sign: 1 | -1) => {
        const ys = slices
            .filter((slice) => slice.rx > Math.abs(x))
            .map((slice) => slice.y + sign * slice.ry * Math.sqrt(1 - (x / slice.rx) ** 2))
        return sign < 0 ? Math.min(...ys) : Math.max(...ys)
    }
    const points = [
        ...xs.map((x) => [x, edge(x, -1)]),
        ...xs.toReversed().map((x) => [x, edge(x, 1)])
    ]
    return `M ${points.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join(' L ')} Z`
}

// An ellipse as a path, for clips.
export function ellipsePath({ y, rx, ry }: Ellipse): string {
    return `M ${-rx} ${y} A ${rx} ${ry} 0 1 0 ${rx} ${y} A ${rx} ${ry} 0 1 0 ${-rx} ${y} Z`
}

// The top of a disc, where the crease shows when another rests on it.
export function topEllipse(view: BoardView, radius: number): Ellipse {
    return flatEllipse(view, radius)(THICKNESS, TOP_RADIUS)
}

function flatEllipse(view: BoardView, radius: number) {
    return (height: number, r: number): Ellipse => ({
        y: -view.height(height * radius),
        rx: r * radius,
        ry: r * radius * view.tilt
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
export function topProfile(distance: number): number {
    return THICKNESS - grooveDepth(distance)
}

// The distances bounding the top's bands, from the edge inward: one band across each flat, many
// across the groove.
function bandEdges(): number[] {
    const span = (from: number, to: number, count: number) =>
        Array.from({ length: count }, (_, index) => from + ((to - from) * index) / count)
    return [TOP_RADIUS, ...span(TROUGH.outer, TROUGH.inner, GROOVE_BANDS), TROUGH.inner, 0]
}

// As GIPF's trough: the floor darker than the top, the far wall in shade, the near lip catching
// the light; steeper walls more so.
export function topBands(view: BoardView, radius: number, color: PieceColor): Band[] {
    const ellipse = flatEllipse(view, radius)
    const edges = bandEdges()
    const { flat, floor } = palette(color)
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

// A speck on the top, centred `u` to the right and `v` away from you and reaching `extent` from
// its centre, all over the radius: where it shows on screen from the top's centre, how much it
// shrinks, how much its surface there is squeezed up the screen against the flat top's, and its
// colour in the light there. A speck lies wholly on the flat or wholly in the groove, never across
// a lip, where it would hide the groove's edge, nor past the disc's edge (it runs on over the
// rounded rim, drawn as the top): one that would shrinks to fit, or is left out if it would shrink too far, as is one the top nearer you hides, as the groove's near lip hides the
// floor just behind it.
export function topSpeck(
    view: BoardView,
    radius: number,
    color: PieceColor,
    speck: { u: number; v: number; extent: number; fill: string }
): { x: number; y: number; scale: number; squeeze: number; fill: string } | undefined {
    const { u, v } = speck
    const distance = Math.max(1e-6, Math.hypot(u, v))
    const room = Math.min(
        1 - distance,
        ...[TROUGH.outer, TROUGH.inner].map((lip) => Math.abs(distance - lip))
    )
    const scale = Math.min(1, room / speck.extent)
    if (scale < MIN_SPECK_SCALE) return undefined
    const extent = speck.extent * scale

    const screenY = (along: number) =>
        -view.height((topProfile(Math.hypot(u, along)) - THICKNESS) * radius) -
        along * view.tilt * radius
    // Its nearest point, on the surface there. Nothing nearer rises above the flat top, so only a
    // point down in the groove can be hidden.
    const front = v - extent
    if (topProfile(Math.hypot(u, front)) < THICKNESS) {
        const frontY = screenY(front)
        const STEPS = 24
        const reach = Math.sqrt(Math.max(0, TOP_RADIUS ** 2 - u * u))
        for (let step = 1; step <= STEPS; step++) {
            const nearer = front - ((front + reach) * step) / STEPS
            if (screenY(nearer) < frontY - radius * 0.002) return undefined
        }
    }

    const d = 0.004
    const slope = (topProfile(distance + d) - topProfile(distance - d)) / (2 * d)
    const rise = (slope * v) / distance
    const squeeze = (view.tilt + view.height(rise)) / view.tilt
    return {
        x: u * radius,
        y: screenY(v),
        scale,
        squeeze: Math.max(0.15, squeeze),
        fill: css(steps(lightAt(color, rgb(speck.fill), u, v)))
    }
}

// A colour on the top lit as the top is there (topBands, with LookDefs' wall gradients over
// them): darker on the groove's floor, and on its steep walls in shade on the far half of the
// disc, catching the light on the near half, most at the far and near points, none at the sides.
function lightAt(color: PieceColor, tint: Rgb, u: number, v: number): Rgb {
    const { flat, floor, farWall, nearWall } = palette(color)
    const distance = Math.max(1e-6, Math.hypot(u, v))
    const step = 0.004
    const slope = Math.abs(topProfile(distance + step) - topProfile(distance - step)) / (2 * step)
    const steep = Math.min(1, slope / 0.6)
    const depth = Math.min(1, (THICKNESS - topProfile(distance)) / TROUGH_DEPTH)
    const away = v / distance
    const base = mix(flat, floor, depth)
    const lit = away > 0 ? mix(base, farWall, steep * away) : mix(base, nearWall, -steep * away)
    // The speck takes the change in light from the flat top, channel by channel.
    return tint.map((value, index) => (value * (lit[index] + 8)) / (flat[index] + 8)) as Rgb
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

// A speck's colour rounded to a few steps, so the specks of a disc share a handful of colours and
// draw as a path each.
function steps(color: Rgb): Rgb {
    return color.map((value) => Math.round(value / 8) * 8) as Rgb
}

// A speck on the disc's side, across it from -1 at the left to 1 at the right, in the side's
// light (sideStops): rounded away from the light at either edge.
export function sideSpeckFill(tint: string, across: number): string {
    const at = (across + 1) / 2
    const light =
        at < 0.32 ? 0.75 + (1.06 - 0.75) * (at / 0.32) : 1.06 - (1.06 - 0.62) * ((at - 0.32) / 0.68)
    return css(steps(rgb(tint).map((value) => Math.min(255, value * light)) as Rgb))
}

// Each color's shades, from its style: the side lit by its face color and shaded by its edge
// color; the top flat in its face color, the groove's floor darker, its far wall in shade and its
// near wall catching the light; and the crease, the top of a disc in the shadow of the one on it.
function palette(color: PieceColor) {
    const style = PIECE_STYLES[color]
    const face = rgb(style.face)
    const edge = rgb(style.edge)
    return {
        lit: face,
        shaded: edge,
        flat: face,
        floor: mix(face, edge, 0.25),
        farWall: mix(face, edge, 0.55),
        nearWall: mix(face, rgb(style.bevel), 0.4),
        crease: mix(edge, face, 0.15)
    }
}

// The walls' colours, for LookDefs' gradients.
export function wallColors(color: PieceColor): { far: string; near: string } {
    const { farWall, nearWall } = palette(color)
    return { far: css(farWall), near: css(nearWall) }
}

export function creaseColor(color: PieceColor): string {
    return css(palette(color).crease)
}

// The stops across a slice, left to right: rounded away from the light at either edge.
export function sideStops(color: PieceColor, shade: number): { offset: number; color: string }[] {
    const { lit, shaded } = palette(color)
    const facing = (shade / (SHADE_LEVELS - 1)) * 2 - 1
    const light = 0.55 + 0.45 * facing
    const base = mix(shaded, lit, Math.min(1, Math.max(0, light)))
    return [
        { offset: 0, color: css(base, 0.75) },
        { offset: 0.32, color: css(base, 1.06) },
        { offset: 1, color: css(base, 0.62) }
    ]
}
