import { PIECE_MODEL, RISE, TILT, type PieceModel } from './pieceGeometry.js'
import { PIECE_STYLES, type Tone } from './pieceStyle.js'

// A DVONN piece is a thin plastic donut with a straight outer side and a dished top: the outer
// rim and the hole's edge stand at the same height, and from each the top curves down to a flat
// floor in the middle. The underside has the opposite shape, bulging down, so the pieces nest: a
// piece on the board stands on its bulge with its edges raised, and a piece on another sits in
// its dish, a little above it. The corners are a little rounded.
//
// The side is drawn as a lathe: thin slices from the base up, each a flattened circle of the
// side's radius at its height, painted bottom first so each slice leaves only its front edge
// showing. The top is drawn from its height profile as bands from the rim inward, each at its
// height, shaded by which way it faces: a surface facing you catches the light, one facing away
// is in shade, which shows the dish best. The far half of every band is drawn first, outer to
// inner, then the near half, inner to outer, so the nearer rim hides what lies behind it.
//
// Each colour's piece is pre-rendered to an image by scripts/render-looks.mjs; the specks, which
// differ from piece to piece, are drawn over it (specks.ts), and the hole, which shows down
// through the stack, with the stack (StackShape.svelte).

// Fractions of the piece's thickness: the softening of the side's corners and of the hole's
// edge, and how deep the dish is.
const EDGE_ROUND = 0.22
const LIP_ROUND = 0.15
export const DISH_DEPTH = 0.3
// The dish's flat floor, as a share of the width between the hole's edge and the rim.
const FLOOR_SHARE = 0.35
// Slices up the side, and bands across the dish and round into the hole: fine enough that no
// step shows once the looks are drawn larger and scaled down (scripts/render-looks.mjs).
const SLICES = 48
const DISH_BANDS = 60
const LIP_BANDS = 12
// How a colour's dish is shaded: how strongly a slope shows (`gain`), how far a slope facing you
// goes toward the bevel colour (`light`) and one facing away toward the edge colour (`shade`),
// and how far the floor goes toward the edge colour (`floor`).
export type DishShading = { gain: number; light: number; shade: number; floor: number }

const SHADING: DishShading = { gain: 2.2, light: 0.85, shade: 0.7, floor: 0 }

export const DISH_SHADING: Record<Tone, DishShading> = {
    white: SHADING,
    black: SHADING,
    red: SHADING
}

// How many shades a slice can take, from facing straight down to facing straight up.
export const SHADE_LEVELS = 33

export type Ellipse = { y: number; rx: number; ry: number }
export type Slice = Ellipse & { level: number }

// A band of the top between two distances from the centre: the ellipse at its outer edge, whose
// far side shows, and the near half of the band itself; its colour, how far it faces round, and
// whether it rises outward. A sloping band is shaded on top of its colour, on its far half and
// its near half each by which way that half faces, fading to its colour at either side, so the
// shade turns smoothly round.
export type Band = { outer: Ellipse; near: string; color: string; steep: number; rising: boolean }

// Every piece's look, pre-rendered to a file by scripts/render-looks.mjs.
export type Look = { tone: Tone }

export const LOOKS: readonly Look[] = (['white', 'black', 'red'] as const).map((tone) => ({ tone }))

export function lookName({ tone }: Look): string {
    return tone
}

// The box a single piece's look fills, from its underside: the piece, with a little room.
export function lookBox(
    radius: number,
    model: PieceModel = PIECE_MODEL
): { x: number; y: number; width: number; height: number } {
    const margin = radius * 0.04
    const top = model.thickness * radius * RISE + radius * TILT + margin
    const bottom = radius * TILT + margin
    return { x: -radius - margin, y: -top, width: 2 * (radius + margin), height: top + bottom }
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

// Where the top starts in from the side's rounded corner, and where it starts down into the hole.
function rimIn(model: PieceModel): number {
    return 1 - EDGE_ROUND * model.thickness
}

function lipOut(model: PieceModel): number {
    return model.hole + LIP_ROUND * model.thickness
}

// How far down the dish is at a distance from the centre, from 0 at the edges to 1 on the floor:
// from each edge it curves down, steepest at the edge, and levels out onto the floor.
export function dish(distance: number, model: PieceModel = PIECE_MODEL): number {
    const outer = rimIn(model)
    const inner = lipOut(model)
    if (distance <= inner || distance >= outer) return 0
    const curve = ((outer - inner) * (1 - FLOOR_SHARE)) / 2
    const fromEdge = Math.min(distance - inner, outer - distance)
    const along = Math.min(1, fromEdge / curve)
    return 1 - (1 - along) ** 2
}

// The top's height at a distance from the centre, all over the piece's radius.
export function topProfile(distance: number, model: PieceModel = PIECE_MODEL): number {
    const { thickness } = model
    const lip = LIP_ROUND * thickness
    if (distance >= lipOut(model)) {
        return thickness - DISH_DEPTH * thickness * dish(distance, model)
    }
    const into = Math.max(0, lipOut(model) - distance)
    return thickness - lip + Math.sqrt(Math.max(0, lip ** 2 - into ** 2))
}

// How steeply the top rises outward at a distance from the centre, and how far round that turns
// the surface, from flat (0) to facing you or away in full (1).
function slopeAt(distance: number, model: PieceModel): number {
    const step = 0.002
    const from = Math.max(model.hole, distance - step)
    const to = Math.min(rimIn(model), distance + step)
    return (topProfile(to, model) - topProfile(from, model)) / (to - from)
}

function steepness(slope: number, gain: number): number {
    return Math.min(1, (gain * Math.abs(slope)) / Math.sqrt(1 + slope ** 2))
}

function flatEllipse(radius: number) {
    return (height: number, r: number): Ellipse => ({
        y: -height * radius * RISE,
        rx: r * radius,
        ry: r * radius * TILT
    })
}

// The side's slices, from the underside up, for a piece's look.
export function discSlices(radius: number, model: PieceModel = PIECE_MODEL): Slice[] {
    const ellipse = flatEllipse(radius)
    return Array.from({ length: SLICES + 1 }, (_, index) => {
        const height = (model.thickness * index) / SLICES
        const { radius: r, facing } = sideProfile(height, model.thickness)
        return { ...ellipse(height, r), level: level(facing) }
    })
}

// The distances bounding the top's bands, from the rim inward to the hole.
function bandEdges(model: PieceModel): number[] {
    const span = (from: number, to: number, count: number) =>
        Array.from({ length: count }, (_, index) => from + ((to - from) * index) / count)
    return [
        ...span(rimIn(model), lipOut(model), DISH_BANDS),
        ...span(lipOut(model), model.hole, LIP_BANDS),
        model.hole
    ]
}

// The top in its face colour, the floor toward its edge colour, its slopes shaded as they face
// (Band).
export function topBands(
    radius: number,
    tone: Tone,
    model: PieceModel = PIECE_MODEL,
    shading: DishShading = DISH_SHADING[tone]
): Band[] {
    const ellipse = flatEllipse(radius)
    const edges = bandEdges(model)
    const { flat, floor } = palette(tone, shading)
    return edges.slice(0, -1).map((outer, index) => {
        const inner = edges[index + 1]
        const middle = (outer + inner) / 2
        const slope = slopeAt(middle, model)
        // Each near half reaches out under the band outside it, which is drawn after it, so no
        // seam shows between them.
        const reach = edges[Math.max(0, index - 1)]
        return {
            outer: ellipse(topProfile(outer, model), outer),
            near: nearHalf(
                ellipse(topProfile(reach, model), reach),
                ellipse(topProfile(inner, model), inner)
            ),
            color: css(mix(flat, floor, dish(middle, model))),
            steep: steepness(slope, shading.gain),
            rising: slope > 0
        }
    })
}

// The near half of a band, between its outer and inner edges, each at its own height.
function nearHalf(outer: Ellipse, inner: Ellipse): string {
    return [
        `M ${-outer.rx} ${outer.y}`,
        `A ${outer.rx} ${outer.ry} 0 0 0 ${outer.rx} ${outer.y}`,
        `L ${inner.rx} ${inner.y}`,
        `A ${inner.rx} ${inner.ry} 0 0 1 ${-inner.rx} ${inner.y}`,
        'Z'
    ].join(' ')
}

// The ellipses a stack's hole is drawn from, and where its top meets its side: on a covered
// piece, the crease under the next.
export type PieceDrawing = {
    rim: Ellipse
    // The hole's narrowest openings, below its rounded top edge and above its bottom one.
    opening: Ellipse
    bottomOpening: Ellipse
    height: number
}

export function pieceDrawing(radius: number, model: PieceModel = PIECE_MODEL): PieceDrawing {
    const ellipse = flatEllipse(radius)
    const { thickness, hole } = model
    return {
        rim: ellipse(thickness, rimIn(model)),
        opening: ellipse(thickness - LIP_ROUND * thickness, hole),
        bottomOpening: ellipse(LIP_ROUND * thickness, hole),
        height: thickness * radius * RISE
    }
}

// The piece's outline on screen, from its underside: the top edge of its side's slices from left
// to right, and their bottom edge back.
export function discOutline(radius: number, model: PieceModel = PIECE_MODEL): string {
    const slices = discSlices(radius, model)
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

// The least a speck shrinks to keep on the top; smaller, it is left out.
const MIN_SPECK_SCALE = 0.4

// A speck on the top of a piece, centred `x` to the right and `y` toward you and reaching
// `extent` from its centre, all over the radius: where it shows on screen from the rim's centre,
// how much it shrinks, how much its surface there is squeezed up the screen against a flat top's,
// and its colour in the light there. A speck runs on over the rounded rim, drawn as the top, but
// not past the piece's edge, nor into the hole: one that would shrinks to fit, or is left out if
// it would shrink too far. The dish is too shallow for its rim to hide any of its floor.
export function topSpeck(
    radius: number,
    tone: Tone,
    speck: { x: number; y: number; extent: number; fill: string },
    model: PieceModel = PIECE_MODEL
): { x: number; y: number; scale: number; squeeze: number; fill: string } | undefined {
    const { x, y } = speck
    const distance = Math.max(1e-6, Math.hypot(x, y))
    const room = Math.min(1 - distance, distance - model.hole)
    const scale = Math.min(1, room / speck.extent)
    if (scale < MIN_SPECK_SCALE) return undefined

    const along = Math.min(distance, rimIn(model))
    const slope = slopeAt(along, model)
    // Rising outward, the surface faces you on the far side (y below 0) and away on the near.
    const rise = (-slope * y) / distance
    const squeeze = (TILT + rise * RISE) / TILT
    return {
        x: x * radius,
        y: -(topProfile(along, model) - model.thickness) * radius * RISE + y * TILT * radius,
        scale,
        squeeze: Math.max(0.15, squeeze),
        fill: css(steps(lightAt(tone, rgb(speck.fill), x, y, model)))
    }
}

// A colour on the top lit as the top is there (topBands, with LookDefs' slope gradients over
// them): its slopes catching the light where they face you, in shade where they face away, most
// at the far and near points, none at the sides.
function lightAt(tone: Tone, tint: Rgb, x: number, y: number, model: PieceModel): Rgb {
    const distance = Math.max(1e-6, Math.hypot(x, y))
    const along = Math.min(distance, rimIn(model))
    const shading = DISH_SHADING[tone]
    const { flat, floor, shade, light } = palette(tone, shading)
    const slope = slopeAt(along, model)
    const steep = steepness(slope, shading.gain)
    const away = -y / distance
    const facingYou = slope > 0 ? away : -away
    const base = mix(flat, floor, dish(along, model))
    const lit =
        facingYou > 0 ? mix(base, light, steep * facingYou) : mix(base, shade, -steep * facingYou)
    // The speck takes the change in light from the flat top, channel by channel.
    return tint.map((value, index) => (value * (lit[index] + 8)) / (flat[index] + 8)) as Rgb
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

// A speck's colour rounded to a few steps, so the specks of a piece share a handful of colours and
// draw as a path each.
function steps(color: Rgb): Rgb {
    return color.map((value) => Math.round(value / 8) * 8) as Rgb
}

// A colour's shades on the top, from its style: flat in its face colour, the floor toward its
// edge colour, a slope facing you catching the light and one facing away in shade.
function palette(tone: Tone, shading: DishShading) {
    const style = PIECE_STYLES[tone]
    const face = rgb(style.face)
    const edge = rgb(style.edge)
    return {
        flat: face,
        floor: mix(face, edge, shading.floor),
        shade: mix(face, edge, shading.shade),
        light: mix(face, rgb(style.bevel), shading.light)
    }
}

// The slopes' colours, for LookDefs' gradients.
export function slopeColors(
    tone: Tone,
    shading: DishShading = DISH_SHADING[tone]
): { shade: string; light: string } {
    const { shade, light } = palette(tone, shading)
    return { shade: css(shade), light: css(light) }
}

// How bright the side is across a slice: rounded away from the light at either edge, gently, as
// YINSH's are, so the white pieces stay white.
const SIDE_LIGHT = { left: 0.9, peak: 1.03, peakAt: 0.32, right: 0.8 }

// The stops across a side slice, left to right.
export function sideStops(tone: Tone, shade: number): { offset: number; color: string }[] {
    const facing = (shade / (SHADE_LEVELS - 1)) * 2 - 1
    const style = PIECE_STYLES[tone]
    const light = 0.55 + 0.45 * facing
    const base = mix(rgb(style.edge), rgb(style.face), Math.min(1, Math.max(0, light)))
    return [
        { offset: 0, color: css(base, SIDE_LIGHT.left) },
        { offset: SIDE_LIGHT.peakAt, color: css(base, SIDE_LIGHT.peak) },
        { offset: 1, color: css(base, SIDE_LIGHT.right) }
    ]
}

// A speck on a piece's side, across it from -1 at the left to 1 at the right, in the side's light
// (sideStops).
export function sideSpeckFill(tint: string, across: number): string {
    const { left, peak, peakAt, right } = SIDE_LIGHT
    const at = (across + 1) / 2
    const light =
        at < peakAt
            ? left + (peak - left) * (at / peakAt)
            : peak - (peak - right) * ((at - peakAt) / (1 - peakAt))
    return css(steps(rgb(tint).map((value) => Math.min(255, value * light)) as Rgb))
}

// The top of a covered piece, in the shadow of the piece resting on it.
export function creaseColor(tone: Tone): string {
    return css(mix(rgb(PIECE_STYLES[tone].edge), [0, 0, 0], 0.35))
}

// Where a mark lies on a stack's top piece, relative to the piece's underside: a ring just
// inside the rim, at the top's height there.
export function markRing(radius: number, model: PieceModel = PIECE_MODEL): Ellipse {
    const distance = rimIn(model) - 0.04
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
