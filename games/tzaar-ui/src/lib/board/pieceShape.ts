import { PieceKind } from '@tabletop/tzaar'
import { PIECE_MODEL, RISE, TILT, type PieceModel } from './pieceGeometry.js'
import { metalOf, SURFACE_STYLES, type Surface, type Tone } from './pieceStyle.js'

// A TZAAR piece is a GIPF piece with a sunken middle, drawn as MATRX GIPF's discs are: a plastic
// disc with rounded edges and a flat top, with a circular groove set in from the edge, its lips
// rounded down to a rounded floor; inside it a flat ring level with the edge, and inside the ring
// the centre is sunk, its edge rounded down to a flat floor. A Tzarra's sunken centre is metal,
// gold on white and silver on black; a Tzaar's groove is metal too. A Tott is plain.
//
// The side is drawn as a lathe: thin slices from the base up, each a flattened circle of the
// side's radius at its height, painted bottom first so each slice leaves only its front edge
// showing. The top is drawn from one height profile as bands from the edge inward, each at its
// height, shaded by which way it faces: the far half of every band first, outer to inner, so a
// lower band further in shows where it is nearer you; then the near half, inner to outer, so a
// higher band further out hides a lower one behind it.
//
// Each tone and kind's piece is pre-rendered to an image by scripts/render-looks.mjs; the specks,
// which differ from piece to piece, are drawn over it (specks.ts).

// All as fractions of the piece's radius, the heights through the thickness.
const BASE_ROUND = 0.25
const RIM_ROUND = 0.3
// Where the groove's lips start down, and its depth; how much of each side of it is its rounded
// wall, the rest its floor.
const TROUGH = { outer: 0.84, inner: 0.62 }
const TROUGH_DEPTH = 0.4
const GROOVE_WALL = 0.42
// Where the sunken centre's rounded edge starts down, its floor, and its depth.
const CENTRE = { top: 0.38, floor: 0.3 }
const CENTRE_DEPTH = 0.32
// Slices up the side, and the side's shades: fine enough that no step shows once the look is
// scaled down.
const SLICES = 48
// Bands across the groove and down the centre's edge: enough that their shades step too finely to
// see once the looks are drawn larger and scaled down (scripts/render-looks.mjs).
const GROOVE_BANDS = 60
const CENTRE_BANDS = 30

// How many shades a slice can take, from facing straight down to facing straight up.
export const SHADE_LEVELS = 33

export type Ellipse = { y: number; rx: number; ry: number }
export type Slice = Ellipse & { level: number }

// A band of the top between two distances from the centre: the ellipse at its outer edge, whose
// far side shows, and the near half of the band itself; its surface, its colour, and how steep it
// is. A steep band's wall is shaded on top of its colour, darker towards the far side and lighter
// towards the near side, fading to its colour at either end, so the shade turns smoothly round.
export type Band = { outer: Ellipse; near: string; surface: Surface; color: string; steep: number }

// Every piece's look, pre-rendered to a file by scripts/render-looks.mjs.
export type Look = { tone: Tone; kind: PieceKind }

export const LOOKS: readonly Look[] = (['white', 'black'] as const).flatMap((tone) =>
    Object.values(PieceKind).map((kind) => ({ tone, kind }))
)

export function lookName({ tone, kind }: Look): string {
    return `${tone}-${kind}`
}

function topRadius(model: PieceModel): number {
    return 1 - RIM_ROUND * model.thickness * 0.6
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

// The side's radius and how it faces at a height up it, all over the piece's radius.
function sideProfile(height: number, thickness: number): { radius: number; facing: number } {
    const base = BASE_ROUND * thickness
    if (height < base) {
        const from = base - height
        return {
            radius: 1 - base + Math.sqrt(Math.max(0, base ** 2 - from ** 2)),
            facing: -from / base
        }
    }
    const rim = RIM_ROUND * thickness
    const rimStart = thickness - rim
    if (height > rimStart) {
        const into = height - rimStart
        return {
            radius: 1 - rim + Math.sqrt(Math.max(0, rim ** 2 - into ** 2)),
            facing: into / rim
        }
    }
    return { radius: 1, facing: 0 }
}

function level(facing: number): number {
    return Math.round(((facing + 1) / 2) * (SHADE_LEVELS - 1))
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

// How deep the groove is at a distance across it, over the thickness: each lip rounds down into
// a rounded floor, level in the middle.
function grooveDepth(distance: number): number {
    const { outer, inner } = TROUGH
    if (distance >= outer || distance <= inner) return 0
    const across = (outer - distance) / (outer - inner)
    const fromLip = Math.min(across, 1 - across) / GROOVE_WALL
    return fromLip >= 1 ? TROUGH_DEPTH : (TROUGH_DEPTH * (1 - Math.cos(Math.PI * fromLip))) / 2
}

// How deep the sunken centre is at a distance from the middle, over the thickness: its edge
// rounded down from CENTRE.top to a flat floor at CENTRE.floor.
function centreDepth(distance: number): number {
    if (distance <= CENTRE.floor) return CENTRE_DEPTH
    if (distance >= CENTRE.top) return 0
    const along = (CENTRE.top - distance) / (CENTRE.top - CENTRE.floor)
    return (CENTRE_DEPTH * (1 - Math.cos(Math.PI * along))) / 2
}

// The top's height at a distance from the centre, all over the piece's radius.
export function topProfile(distance: number, model: PieceModel = PIECE_MODEL): number {
    return model.thickness * (1 - grooveDepth(distance) - centreDepth(distance))
}

// Which parts of the top are metal.
export function isMetal(kind: PieceKind, distance: number): boolean {
    const inCentre = distance < CENTRE.top
    const inGroove = distance > TROUGH.inner && distance < TROUGH.outer
    if (kind === PieceKind.Tzaar) return inCentre || inGroove
    return kind === PieceKind.Tzarra && inCentre
}

function surfaceAt({ tone, kind }: Look, distance: number): Surface {
    return isMetal(kind, distance) ? metalOf(tone) : tone
}

// The distances bounding the top's bands, from the edge inward: one band across each flat, many
// across the groove and down the centre's edge.
function bandEdges(model: PieceModel): number[] {
    const span = (from: number, to: number, count: number) =>
        Array.from({ length: count }, (_, index) => from + ((to - from) * index) / count)
    return [
        topRadius(model),
        ...span(TROUGH.outer, TROUGH.inner, GROOVE_BANDS),
        TROUGH.inner,
        ...span(CENTRE.top, CENTRE.floor, CENTRE_BANDS),
        CENTRE.floor,
        0
    ]
}

// How much of a hollow's shade it takes, its floor and its walls: a white sunken centre, a
// Tott's, less than the rest.
const WHITE_CENTRE_SHADE = 0.5

function shadeAt(surface: Surface, distance: number): number {
    return surface === 'white' && distance < CENTRE.top ? WHITE_CENTRE_SHADE : 1
}

// The floors darker than the top, the far walls in shade, the near lips catching the light;
// steeper walls more so. Each band is of its surface: plastic, or the markings' metal.
export function topBands(radius: number, look: Look, model: PieceModel = PIECE_MODEL): Band[] {
    const ellipse = flatEllipse(radius)
    const edges = bandEdges(model)
    const { thickness } = model
    return edges.slice(0, -1).map((outer, index) => {
        const inner = edges[index + 1]
        const outerHeight = topProfile(outer, model) / thickness
        const innerHeight = topProfile(inner, model) / thickness
        const slope = (Math.abs(outerHeight - innerHeight) * thickness) / (outer - inner)
        const surface = surfaceAt(look, (outer + inner) / 2)
        const shade = shadeAt(surface, (outer + inner) / 2)
        const steep = Math.min(1, slope / 0.6) * shade
        const depth = Math.min(1, (1 - (outerHeight + innerHeight) / 2) / TROUGH_DEPTH) * shade
        const { flat, floor } = palette(surface)
        // Each near half reaches out under the band outside it, which is drawn after it, so no
        // seam shows between them.
        const reach = edges[Math.max(0, index - 1)]
        return {
            outer: ellipse(outerHeight * thickness, outer),
            near: nearHalf(
                ellipse(topProfile(reach, model), reach),
                ellipse(innerHeight * thickness, inner)
            ),
            surface,
            color: css(mix(flat, floor, depth)),
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

// The top of a piece, where the crease shows when another rests on it.
export function topEllipse(radius: number, model: PieceModel = PIECE_MODEL): Ellipse {
    return flatEllipse(radius)(model.thickness, topRadius(model))
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

// An ellipse as a path, for clips.
export function ellipsePath({ y, rx, ry }: Ellipse): string {
    return `M ${-rx} ${y} A ${rx} ${ry} 0 1 0 ${rx} ${y} A ${rx} ${ry} 0 1 0 ${-rx} ${y} Z`
}

// The least a speck shrinks to keep off the lips; smaller, it is left out.
const MIN_SPECK_SCALE = 0.4

// A speck on the top of a piece of a kind, centred `x` to the right and `y` toward you and
// reaching `extent` from its centre, all over the radius: where it shows on screen from the top's
// centre, how much it shrinks, how much its surface there is squeezed up the screen against the
// flat top's, and its colour in the light there. A speck lies wholly on a flat, in the groove or
// in the sunken centre, never across a lip, where it would hide the edge, nor past the piece's
// edge (it runs on over the rounded rim, drawn as the top): one that would shrinks to fit, or is
// left out if it would shrink too far, as is one on metal, and one the top nearer you hides, as a
// lip hides the floor just behind it.
export function topSpeck(
    radius: number,
    look: Look,
    speck: { x: number; y: number; extent: number; fill: string },
    model: PieceModel = PIECE_MODEL
): { x: number; y: number; scale: number; squeeze: number; fill: string } | undefined {
    const { x, y } = speck
    const distance = Math.max(1e-6, Math.hypot(x, y))
    if (isMetal(look.kind, distance)) return undefined
    const room = Math.min(
        1 - distance,
        ...[TROUGH.outer, TROUGH.inner, CENTRE.top].map((lip) => Math.abs(distance - lip))
    )
    const scale = Math.min(1, room / speck.extent)
    if (scale < MIN_SPECK_SCALE) return undefined
    const extent = speck.extent * scale

    const { thickness } = model
    const screenY = (along: number) =>
        -(topProfile(Math.hypot(x, along), model) - thickness) * radius * RISE +
        along * TILT * radius
    // Its nearest point, on the surface there, hidden where the top nearer you shows above it on
    // screen. Nothing nearer rises above the flat top, so only a point down in a hollow can be.
    const front = y + extent
    if (topProfile(Math.hypot(x, front), model) < thickness) {
        const frontY = screenY(front)
        const STEPS = 24
        const reach = Math.sqrt(Math.max(0, topRadius(model) ** 2 - x * x))
        for (let step = 1; step <= STEPS; step++) {
            const nearer = front + ((reach - front) * step) / STEPS
            if (screenY(nearer) < frontY - radius * 0.002) return undefined
        }
    }

    const d = 0.004
    const slope = (topProfile(distance + d, model) - topProfile(distance - d, model)) / (2 * d)
    // Rising outward, the surface faces you on the far side (y below 0) and away on the near.
    const rise = (-slope * y) / distance
    const squeeze = (TILT + rise * RISE) / TILT
    return {
        x: x * radius,
        y: screenY(y),
        scale,
        squeeze: Math.max(0.15, squeeze),
        fill: css(steps(lightAt(look, rgb(speck.fill), x, y, model)))
    }
}

// A colour on the top lit as the top is there (topBands, with LookDefs' wall gradients over
// them): darker in the hollows, and on their steep walls in shade on the far half of the piece,
// catching the light on the near half, most at the far and near points, none at the sides.
function lightAt(look: Look, tint: Rgb, x: number, y: number, model: PieceModel): Rgb {
    const distance = Math.max(1e-6, Math.hypot(x, y))
    const surface = surfaceAt(look, distance)
    const { flat, floor, farWall, nearWall } = palette(surface)
    const step = 0.004
    const slope =
        Math.abs(topProfile(distance + step, model) - topProfile(distance - step, model)) /
        (2 * step)
    const shade = shadeAt(surface, distance)
    const steep = Math.min(1, slope / 0.6) * shade
    const depth =
        Math.min(1, (1 - topProfile(distance, model) / model.thickness) / TROUGH_DEPTH) * shade
    const away = -y / distance
    const base = mix(flat, floor, depth)
    const lit = away > 0 ? mix(base, farWall, steep * away) : mix(base, nearWall, -steep * away)
    // The speck takes the change in light from the flat top, channel by channel.
    return tint.map((value, index) => (value * (lit[index] + 8)) / (flat[index] + 8)) as Rgb
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

// A speck's colour rounded to a few steps, so the specks of a piece share a handful of colours and
// draw as a path each.
function steps(color: Rgb): Rgb {
    return color.map((value) => Math.round(value / 8) * 8) as Rgb
}

// A surface's shades, from its style: the side lit by its face colour and shaded by its edge
// colour; the top flat in its face colour, a hollow's floor darker, its far wall in shade and its
// near wall catching the light.
function palette(surface: Surface) {
    const style = SURFACE_STYLES[surface]
    const face = rgb(style.face)
    const edge = rgb(style.edge)
    return {
        flat: face,
        floor: mix(face, edge, 0.25),
        farWall: mix(face, edge, 0.55),
        nearWall: mix(face, rgb(style.bevel), 0.4)
    }
}

// The walls' colours, for LookDefs' gradients.
export function wallColors(surface: Surface): { far: string; near: string } {
    const { farWall, nearWall } = palette(surface)
    return { far: css(farWall), near: css(nearWall) }
}

// The stops across a side slice, left to right, as GIPF's and LYNGK's: rounded away from the
// light at either edge.
export function sideStops(surface: Surface, shade: number): { offset: number; color: string }[] {
    const style = SURFACE_STYLES[surface]
    const facing = (shade / (SHADE_LEVELS - 1)) * 2 - 1
    const light = 0.55 + 0.45 * facing
    const base = mix(rgb(style.edge), rgb(style.face), Math.min(1, Math.max(0, light)))
    return [
        { offset: 0, color: css(base, 0.75) },
        { offset: 0.32, color: css(base, 1.06) },
        { offset: 1, color: css(base, 0.62) }
    ]
}

// A speck on a piece's side, across it from -1 at the left to 1 at the right, in the side's light
// (sideStops): rounded away from the light at either edge.
export function sideSpeckFill(tint: string, across: number): string {
    const at = (across + 1) / 2
    const light =
        at < 0.32 ? 0.75 + (1.06 - 0.75) * (at / 0.32) : 1.06 - (1.06 - 0.62) * ((at - 0.32) / 0.68)
    return css(steps(rgb(tint).map((value) => Math.min(255, value * light)) as Rgb))
}

// The top of a covered piece, in the shadow of the piece resting on it, as GIPF's and LYNGK's.
export function creaseColor(tone: Tone): string {
    const { face, edge } = SURFACE_STYLES[tone]
    return css(mix(rgb(edge), rgb(face), 0.15))
}

// Where a mark lies on a stack's top piece, relative to the piece's underside: a ring on the flat
// edge between the side and the groove.
export function markRing(radius: number, model: PieceModel = PIECE_MODEL): Ellipse {
    const distance = (TROUGH.outer + topRadius(model)) / 2
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
