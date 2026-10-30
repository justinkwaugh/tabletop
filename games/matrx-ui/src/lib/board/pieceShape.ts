import { PieceKind } from '@tabletop/matrx'
import type { BoardView } from './geometry.js'
import type { Point } from '@tabletop/common'
import { hull } from './hull.js'

// A GIPF project piece, as the published ones are: a thin plastic disc with rounded edges and a
// flat top, with a circular groove set in from the edge, its lips rounded down to a rounded
// floor. A ring on the underside fits the groove of the piece below. MATRX's potentials are the same disc with their game's mark: TAMSK a second
// ring inside the trough, ZÈRTZ three notches across the rim, DVONN a hole through the middle,
// YINSH a channel running in from the trough, PÜNCT notches round the edge.
//
// The disc is drawn as a lathe: thin slices from the base up, each a flattened circle of the
// profile's radius at its height, painted bottom first so each slice leaves only its front edge
// showing. A slice's shade follows the way its surface faces, darker where it turns under. The
// top is drawn from one height profile as bands from the edge inward, each at its height, shaded
// by which way it faces: the far half of every band first, outer to inner, so a lower band
// further in shows where it is nearer you; then the near half, inner to outer, so a higher band
// further out hides a lower one behind it.

export type Tone = 'light' | 'dark'

// One disc of a stack, bottom up.
export type Disc = { tone: Tone; kind: PieceKind }

export const TONES: readonly Tone[] = ['light', 'dark']

// Every disc there is: each kind in each tone.
export const DISC_LOOKS: readonly Disc[] = TONES.flatMap((tone) =>
    Object.values(PieceKind).map((kind) => ({ tone, kind }))
)

// A disc's look's name: the file it is pre-rendered to (see scripts/render-looks.mjs).
export function lookName(disc: Disc): string {
    return `${disc.tone}-${disc.kind}`
}

// The id of a disc's look, drawn in an SVG under its prefix.
export function discLookId(prefix: string, disc: Disc): string {
    return `${prefix}-disc-${lookName(disc)}`
}

// The box a single disc's look fills, from its base: the disc and its cuts, with a little room.
export function lookBox(
    view: BoardView,
    radius: number
): { x: number; y: number; width: number; height: number } {
    const margin = radius * 0.04
    const top = view.height(THICKNESS * radius) + radius * view.tilt + margin
    const bottom = radius * view.tilt + margin
    return { x: -radius - margin, y: -top, width: 2 * (radius + margin), height: top + bottom }
}

// All as fractions of the piece's radius.
export const THICKNESS = 0.2826
const BASE_ROUND = THICKNESS * 0.25
const RIM_ROUND = THICKNESS * 0.3
// Each disc rests on its underside ring, a little above the disc below, so a dark crease shows
// between them: the lower disc's top, in the upper disc's shadow. The bottom disc stands on its
// ring as far above the board.
const STACK_GAP = THICKNESS * 0.32
// Distances from the centre where the groove's lips start down, and its depth.
const TROUGH = { outer: 0.84, inner: 0.62 }
const TROUGH_DEPTH = THICKNESS * 0.4
// How much of each side of a groove is its rounded wall; the rest is its floor.
const GROOVE_WALL = 0.42
const SLICES = 12
const TOP_RADIUS = 1 - RIM_ROUND * 0.6
// Bands across each groove.
const GROOVE_BANDS = 14

// TAMSK's second groove, inside the first, round a small centre mound (measured on the box art).
const TAMSK = { outer: 0.4, inner: 0.18 }
// ZÈRTZ's notches run out across the rim from the trough, at three points round the disc.
const ZERTZ_ANGLES = [80, 200, 320]
// Each is half a cylinder taken out of the rim, as deep as the ring groove, running on into the
// groove, where it blends into the groove's wall with a rounded fillet.
const ZERTZ_RADIUS = 0.11
const ZERTZ_FILLET = 0.04
// Its lips round over into the top with a fillet of this radius.
const ZERTZ_LIP = 0.04
// Where the notch's surface is drawn from, inside the groove's floor, and the cells across and
// along it, for its shading.
const ZERTZ_FROM = TROUGH.outer - (TROUGH.outer - TROUGH.inner) * 0.6
const ZERTZ_ACROSS = 32
const ZERTZ_ALONG = 6
// How far a carving must lower the top before it is drawn, and before it is drawn solid.
const CARVE_MIN = 0.006
const CARVE_FADE = 0.012
// The board is seen from this steep an angle: a surface sloping away from you more steeply
// faces away.
const FACING_AWAY_SLOPE = -1.1
// DVONN's hole goes right through; the top is flat up to it, its edge a little rounded.
const DVONN = { lip: 0.385, hole: 0.36, drop: THICKNESS * 0.1 }
// YINSH's channel: a rounded groove, at its deepest as deep as the trough, running across from
// the trough on the left, a little beyond the centre, and stopping short of the right side with a
// rounded end.
const YINSH_HALF_WIDTH = (TROUGH.outer - TROUGH.inner) / 2
const YINSH_OFFSET = 0.04
const YINSH_END = 0.38
// Strips across it, and steps round its rounded end.
const YINSH_STRIPS = 24
const YINSH_TURNS = 48
// PÜNCT's notches cut into the edge, all the way down.
const PUNCT_NOTCHES = 6
const PUNCT_DEPTH = 0.1
const PUNCT_HALF_WIDTH = 0.1
// Strips round each notch's rounded end, for its shading.
const PUNCT_WALL_STRIPS = 24
// How far a notch's straight side may face away and still be drawn.
const EDGE_ON = 0.35

// How many shades a slice can take, from facing straight down to facing straight up.
export const SHADE_LEVELS = 9

export type Slice = { y: number; rx: number; ry: number; level: number }
export type Ellipse = { y: number; rx: number; ry: number }

// A band of the top between two distances from the centre: the ellipse at its outer edge, whose
// far side shows, and the near half of the band itself; its colour, and how steep it is. A steep
// band's wall is shaded on top of its colour, darker towards the far side and lighter towards the
// near side, fading to its colour at either end, so the shade turns smoothly round the ring.
export type Band = { outer: Ellipse; near: string; color: string; steep: number }

// A strip of a curved surface, with its colour.
export type Strip = { d: string; fill: string; opacity: number }

// A band of a disc's side between two heights and two angles, shaded by its slice's level.
export type SideBand = { d: string; level: number }

// A potential's mark on its disc's top face, in the disc's own coordinates.
export type Mark =
    | {
          kind: 'notches'
          through: string[]
          clip: string[]
          backings: string[]
          cells: Strip[]
          outline: string
      }
    | { kind: 'hole'; wall: string; through: string }
    | { kind: 'carved'; clip: string; cells: Strip[] }
    | { kind: 'cuts'; side: SideBand[]; topCuts: string[]; walls: Strip[]; outline: string }

export type PieceDrawing = {
    slices: Slice[]
    // How far up the screen each disc stands, from the bottom up.
    bases: number[]
    // The top of a disc with another on it, in that one's shadow, where the crease shows.
    crease: Ellipse
}

// Heights up the side, through its rounded corners, at which a cut through the side follows it.
const SIDE_HEIGHTS = Array.from({ length: 13 }, (_, step) => (THICKNESS * step) / 12)

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

// The height of a stack's top face over its radius; 0 for no stack.
export function stackTop(discs: number): number {
    return discs === 0 ? 0 : discBases(discs).at(-1)! + THICKNESS
}

export function pieceDrawing(view: BoardView, discs: number, radius: number): PieceDrawing {
    const ellipse = flatEllipse(view, radius)
    const slices = Array.from({ length: SLICES + 1 }, (_, index) => {
        const height = (THICKNESS * index) / SLICES
        const { radius: r, facing } = profile(height)
        return { ...ellipse(height, r), level: level(facing) }
    })
    return {
        slices,
        bases: discBases(discs).map((base) => -view.height(base * radius)),
        crease: ellipse(THICKNESS, TOP_RADIUS)
    }
}

function flatEllipse(view: BoardView, radius: number) {
    return (height: number, r: number): Ellipse => ({
        y: -view.height(height * radius),
        rx: r * radius,
        ry: r * radius * view.tilt
    })
}

// A point on the disc from its centre, `u` to the right and `v` away from you, over the radius,
// at a height over the radius, on screen.
function onFlat(view: BoardView, radius: number) {
    return (u: number, v: number, height = THICKNESS): Point => ({
        x: u * radius,
        y: -v * radius * view.tilt - view.height(height * radius)
    })
}

// The parts of a PÜNCT notch's inside that face you, as strips from the top down to the board:
// either straight side, from the disc's edge in, and the part of its rounded end turned towards
// you, in narrow strips. Each is shaded by the way it faces: lit facing the light, from the left,
// in shade facing away from it.
function notchWalls(
    flat: (u: number, v: number, height?: number) => Point,
    angle: number,
    tone: Tone
): Strip[] {
    const a = (angle * Math.PI) / 180
    const along = { u: Math.cos(a), v: Math.sin(a) }
    const across = { u: -Math.sin(a), v: Math.cos(a) }
    const w = PUNCT_HALF_WIDTH
    const end = 1 - PUNCT_DEPTH + w
    const at = (out: number, side: number, height: number) =>
        flat(along.u * out + across.u * side, along.v * out + across.v * side, height)
    const strip = (
        from: [number, number],
        to: [number, number],
        normal: { u: number; v: number }
    ) => ({
        d: polygon([
            at(from[0], from[1], THICKNESS),
            at(to[0], to[1], THICKNESS),
            at(to[0], to[1], 0),
            at(from[0], from[1], 0)
        ]),
        fill: wallShade(tone, normal),
        opacity: 1
    })
    // A wall faces the notch's middle; it faces you when that points nearer you.
    const facesYou = (normal: { u: number; v: number }) => normal.v < 0
    // Out at the disc's edge, a straight side follows the side's rounded corners down.
    const sides = [1, -1].flatMap((side) => {
        const normal = { u: -across.u * side, v: -across.v * side }
        // Seen nearly edge-on, a straight side still shows where the rim rounds over it.
        if (normal.v > EDGE_ON) return []
        const edge = (height: number) => Math.sqrt(profile(height).radius ** 2 - w * w)
        return [
            {
                d: polygon([
                    at(end, w * side, THICKNESS),
                    ...SIDE_HEIGHTS.toReversed().map((height) =>
                        at(edge(height), w * side, height)
                    ),
                    at(end, w * side, 0)
                ]),
                fill: wallShade(tone, normal),
                opacity: 1
            }
        ]
    })
    const turns = Array.from(
        { length: PUNCT_WALL_STRIPS + 1 },
        (_, step) => (Math.PI * step) / PUNCT_WALL_STRIPS
    )
    const round = turns.slice(0, -1).flatMap((turn, index) => {
        const next = turns[index + 1]
        const middle = (turn + next) / 2
        const normal = {
            u: along.u * Math.sin(middle) - across.u * Math.cos(middle),
            v: along.v * Math.sin(middle) - across.v * Math.cos(middle)
        }
        if (!facesYou(normal)) return []
        // Each strip reaches a little into the next, so no seam shows between them.
        const overlap = (next - turn) * 0.3
        const point = (t: number): [number, number] => [end - Math.sin(t) * w, Math.cos(t) * w]
        return [strip(point(turn - overlap), point(next + overlap), normal)]
    })
    return [...sides, ...round]
}

// A notch wall's colour by the way it faces: lit facing the light, from the left as on the
// pieces' sides, in shade facing right.
function wallShade(tone: Tone, normal: { u: number; v: number }): string {
    const { floor } = TOP_PALETTE[tone]
    const { farWall, nearWall } = NOTCH_WALLS[tone]
    const base = mix(floor, farWall, 0.5)
    return css(
        normal.u < 0 ? mix(base, nearWall, -normal.u * 0.7) : mix(base, farWall, normal.u * 0.8)
    )
}

// A surface carved into the top, drawn as cells over a grid of points on the disc (u to the
// right, v away from you, over the radius): `height` is the carved surface, `untouched` the top
// it was carved from, drawn already. Only cells the carving lowers are drawn, far ones first,
// leaving out those that face away; each is shaded by its depth and slope, as GIPF's trough: in
// shade where it faces you, lit where it faces away.
function carvedCells(
    flat: (u: number, v: number, height?: number) => Point,
    tone: Tone,
    grid: { u: number; v: number }[][],
    height: (u: number, v: number) => number,
    untouched: (u: number, v: number) => number,
    carveMin = CARVE_MIN
): Strip[] {
    const cells: (Strip & { depth: number })[] = []
    for (let i = 0; i < grid.length - 1; i++) {
        for (let j = 0; j < grid[i].length - 1; j++) {
            const corners = [grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]]
            const heights = corners.map(({ u, v }) => height(u, v))
            // A blend rounds two equal heights down a little; only a real cut is drawn.
            const carve = Math.max(...corners.map(({ u, v }, k) => untouched(u, v) - heights[k]))
            if (carve <= carveMin) continue
            const u = corners.reduce((sum, corner) => sum + corner.u, 0) / 4
            const v = corners.reduce((sum, corner) => sum + corner.v, 0) / 4
            const color = shadeAt(tone, height, u, v)
            if (color === undefined) continue
            cells.push({
                // Each cell reaches a little past its neighbours, so no seam shows between them.
                d: polygon(
                    corners.map((corner, k) =>
                        flat(u + (corner.u - u) * 1.15, v + (corner.v - v) * 1.15, heights[k])
                    )
                ),
                fill: color,
                // Barely cut, a cell fades into the surface it was cut from, so the carving's
                // edge is soft rather than stepped.
                opacity: Math.min(1, carve / CARVE_FADE),
                depth: v
            })
        }
    }
    return cells
        .toSorted((p, q) => q.depth - p.depth)
        .map(({ d, fill, opacity }) => ({ d, fill, opacity }))
}

// One of ZÈRTZ's notches: half a cylinder taken out of the rim from inside the ring groove out
// through the edge. Where the cylinder is lower than the groove, the notch's surface shows, its
// height the lower of the two, blended by a fillet where they meet. The rim's part of it is cut
// out of the disc, with the cylinder's end out of the side where the notch faces you; the surface
// is drawn in cells, far ones first, leaving out those that face away, each shaded by its slope:
// in shade facing you, lit facing away, as GIPF's trough.
function rimNotch(
    view: BoardView,
    radius: number,
    angle: number,
    tone: Tone
): { through: string[]; clip: string[]; backing: string[]; cells: Strip[] } {
    const flat = onFlat(view, radius)
    const a = (angle * Math.PI) / 180
    const along = { u: Math.cos(a), v: Math.sin(a) }
    const across = { u: -Math.sin(a), v: Math.cos(a) }
    const r = ZERTZ_RADIUS
    const facesYou = along.v < 0.25
    // Drawn up to the rim, or where it faces you out to the side; cut a little past it, through
    // the rounded corner.
    const reach = facesYou ? 1 : TOP_RADIUS
    const at = (out: number, side: number, height: number) =>
        flat(along.u * out + across.u * side, along.v * out + across.v * side, height)
    // Across the notch: the cylinder, then a fillet round each lip, tangent to the cylinder and
    // to the top, then the top.
    const f = ZERTZ_LIP
    const filletCentre = Math.sqrt((r + f) ** 2 - f ** 2)
    const tangent = (filletCentre * r) / (r + f)
    const notch = (side: number) => {
        const s = Math.abs(side)
        if (s <= tangent) return THICKNESS - Math.sqrt(r * r - s * s)
        if (s < filletCentre) return THICKNESS - f + Math.sqrt(f * f - (s - filletCentre) ** 2)
        return THICKNESS
    }
    const groove = (out: number) => THICKNESS - grooveDepth(out, TROUGH)
    const surface = (out: number, side: number) => smoothMin(groove(out), notch(side), ZERTZ_FILLET)

    const outs = [
        ...Array.from(
            { length: ZERTZ_ALONG },
            (_, step) => ZERTZ_FROM + ((TROUGH.outer - ZERTZ_FROM) * step) / ZERTZ_ALONG
        ),
        TROUGH.outer,
        (TROUGH.outer + reach) / 2,
        reach
    ]
    const width = filletCentre
    const sides = Array.from(
        { length: ZERTZ_ACROSS + 1 },
        (_, step) => -width + (2 * width * step) / ZERTZ_ACROSS
    )
    const toFlat = (out: number, side: number) => ({
        u: along.u * out + across.u * side,
        v: along.v * out + across.v * side
    })
    const outOf = (u: number, v: number) => u * along.u + v * along.v
    const sideOf = (u: number, v: number) => u * across.u + v * across.v
    const cells = carvedCells(
        flat,
        tone,
        outs.map((out) => sides.map((side) => toFlat(out, side))),
        (u, v) => surface(outOf(u, v), sideOf(u, v)),
        (u, v) => groove(outOf(u, v)),
        // Every cell the notch lowers, however little, so its lips round smoothly into the top.
        1e-5
    )
    const opening = (from: number, out: number) =>
        polygon([
            at(from, width, THICKNESS),
            at(out, width, THICKNESS),
            at(out, -width, THICKNESS),
            at(from, -width, THICKNESS)
        ])
    const rim = TROUGH.outer - 0.02
    const floorHeight = THICKNESS - TROUGH_DEPTH
    // Inside the groove, the notch shows wherever its surface lies, down to the groove's floor.
    const inGroove = polygon(
        hull([
            at(ZERTZ_FROM, width, THICKNESS),
            at(rim, width, THICKNESS),
            at(rim, -width, THICKNESS),
            at(ZERTZ_FROM, -width, THICKNESS),
            at(ZERTZ_FROM, width, floorHeight),
            at(rim, width, floorHeight),
            at(rim, -width, floorHeight),
            at(ZERTZ_FROM, -width, floorHeight)
        ])
    )
    // What the notch covers on screen: its lips from the groove to where it leaves the rim, and
    // its rounded profile there. On the far side the board shows through above that profile.
    const footprint = polygon([
        at(rim, width, THICKNESS),
        ...sides.toReversed().map((side) => at(reach, side, notch(side))),
        at(rim, -width, THICKNESS)
    ])
    return {
        // Facing you, the cut is the notch itself; on the far side it also opens the rim above
        // the notch's profile, where the board shows through.
        through: [facesYou ? footprint : opening(rim, 1.03)],
        clip: [footprint, inGroove],
        backing: [footprint],
        cells
    }
}

// The disc's outline on screen, from its base to its top: nothing drawn on it reaches past it.
function discOutline(view: BoardView, radius: number): string {
    const points = Array.from({ length: SLICES + 1 }, (_, index) => {
        const height = (THICKNESS * index) / SLICES
        return { height, r: profile(height).radius }
    }).flatMap(({ height, r }) =>
        Array.from({ length: 48 }, (_, step) => {
            const turn = (Math.PI * 2 * step) / 48
            return {
                x: Math.cos(turn) * r * radius,
                y: -Math.sin(turn) * r * radius * view.tilt - view.height(height * radius)
            }
        })
    )
    return polygon(hull(points))
}

// The lower of two heights, rounded where they meet.
function smoothMin(a: number, b: number, k: number): number {
    const h = Math.max(0, Math.min(1, 0.5 + (0.5 * (b - a)) / k))
    return b + (a - b) * h - k * h * (1 - h)
}

function polygon(points: Point[]): string {
    return `M ${points.map((point) => `${point.x} ${point.y}`).join(' L ')} Z`
}

// How deep a groove between two distances is at a distance across it: each lip rounds down into
// a rounded floor, level in the middle.
function grooveDepth(distance: number, { outer, inner }: { outer: number; inner: number }): number {
    if (distance >= outer || distance <= inner) return 0
    const across = (outer - distance) / (outer - inner)
    const fromLip = Math.min(across, 1 - across) / GROOVE_WALL
    return fromLip >= 1 ? TROUGH_DEPTH : (TROUGH_DEPTH * (1 - Math.cos(Math.PI * fromLip))) / 2
}

// The top's height at a distance from the centre, over the radius.
export function topProfile(kind: PieceKind, distance: number): number {
    const tamsk = kind === PieceKind.Tamsk ? grooveDepth(distance, TAMSK) : 0
    const hole = kind === PieceKind.Dvonn ? lipDrop(distance) : 0
    return THICKNESS - grooveDepth(distance, TROUGH) - tamsk - hole
}

// How far DVONN's top has rounded down towards its hole.
function lipDrop(distance: number): number {
    if (distance >= DVONN.lip) return 0
    const into = Math.min(1, (DVONN.lip - distance) / (DVONN.lip - DVONN.hole))
    return DVONN.drop * (1 - Math.cos((Math.PI * into) / 2))
}

// The distances bounding the top's bands, from the edge inward: one band across each flat, many
// across each groove.
function bandEdges(kind: PieceKind): number[] {
    const span = (from: number, to: number, count: number) =>
        Array.from({ length: count }, (_, index) => from + ((to - from) * index) / count)
    const grooves = kind === PieceKind.Tamsk ? [TROUGH, TAMSK] : [TROUGH]
    let from = TOP_RADIUS
    const edges: number[] = []
    for (const groove of grooves) {
        edges.push(
            ...span(from, groove.outer, 1),
            ...span(groove.outer, groove.inner, GROOVE_BANDS)
        )
        from = groove.inner
    }
    return [...edges, from, 0]
}

// As GIPF's trough: the floor darker than the top, the far wall in shade, the near lip catching
// the light; steeper walls more so.
export function topBands(view: BoardView, kind: PieceKind, radius: number, tone: Tone): Band[] {
    const ellipse = flatEllipse(view, radius)
    const edges = bandEdges(kind)
    const { flat, floor } = TOP_PALETTE[tone]
    return edges.slice(0, -1).map((outer, index) => {
        const inner = edges[index + 1]
        const outerHeight = topProfile(kind, outer)
        const innerHeight = topProfile(kind, inner)
        const slope = Math.abs(outerHeight - innerHeight) / (outer - inner)
        const steep = Math.min(1, slope / 0.6)
        const depth = (THICKNESS - (outerHeight + innerHeight) / 2) / TROUGH_DEPTH
        const base = mix(flat, floor, Math.min(1, depth))
        // Each near half reaches out under the band outside it, which is drawn after it, so no
        // seam shows between them.
        const reach = edges[Math.max(0, index - 1)]
        return {
            outer: ellipse(outerHeight, outer),
            near: nearHalf(ellipse(topProfile(kind, reach), reach), ellipse(innerHeight, inner)),
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

export function markOf(
    view: BoardView,
    kind: PieceKind,
    radius: number,
    tone: Tone
): Mark | undefined {
    switch (kind) {
        case PieceKind.Zertz: {
            const notches = ZERTZ_ANGLES.map((angle) => rimNotch(view, radius, angle, tone))
            return {
                kind: 'notches',
                through: notches.flatMap((notch) => notch.through),
                clip: notches.flatMap((notch) => notch.clip),
                backings: notches.flatMap((notch) => notch.backing),
                cells: notches.flatMap((notch) => notch.cells),
                outline: discOutline(view, radius)
            }
        }
        case PieceKind.Dvonn: {
            const height = topProfile(kind, DVONN.hole)
            const top = flatEllipse(view, radius)(height, DVONN.hole)
            const through = view.height(height * radius)
            return { kind: 'hole', wall: farWall(top, through), through: lens(top, through) }
        }
        case PieceKind.Yinsh:
            return yinshChannel(view, radius, tone)
        case PieceKind.Punct:
            return punctNotches(view, radius, tone)
        default:
            return undefined
    }
}

// PÜNCT's notches, cut through the edge from top to board. The disc's side is built from bands
// of side between the notches rather than drawn whole and cut, so each notch's edges are exact at
// every height: the front of the side, bottom up, and the rim behind, where it rounds over above
// the top. Only the top is cut, by each notch's outline reaching well past the rim. The notches'
// inner walls are drawn first, so the side and top in front of them hide them.
function punctNotches(view: BoardView, radius: number, tone: Tone): Mark {
    const flat = onFlat(view, radius)
    const w = PUNCT_HALF_WIDTH
    const end = 1 - PUNCT_DEPTH + w
    const centres = Array.from(
        { length: PUNCT_NOTCHES },
        (_, index) => ((360 / PUNCT_NOTCHES) * (index + 0.5) * Math.PI) / 180
    )
    // How far round from its centre a notch reaches into the side at a height: where the side's
    // circle there crosses the circle of the notch's rounded end.
    const halfSpan = (height: number) => {
        const r = profile(height).radius
        return Math.acos(Math.min(1, (r * r + end * end - w * w) / (2 * r * end)))
    }
    const arc = (height: number, from: number, to: number) => {
        const r = profile(height).radius
        const steps = Math.max(2, Math.ceil((to - from) / ((2 * Math.PI) / 360)))
        return Array.from({ length: steps + 1 }, (_, step) => {
            const turn = from + ((to - from) * step) / steps
            return flat(r * Math.cos(turn), r * Math.sin(turn), height)
        })
    }
    // The side between each notch and the next, within the angles given, at each pair of heights.
    // Each band reaches a little up into the next, drawn after it, so no seam shows.
    const bands = (heights: readonly number[], within: [number, number]): SideBand[] =>
        heights.slice(0, -1).flatMap((height, index) => {
            const top = Math.min(THICKNESS, heights[index + 1] + THICKNESS * 0.01)
            const middle = (height + heights[index + 1]) / 2
            return centres.flatMap((centre, k) => {
                const next = k + 1 < centres.length ? centres[k + 1] : centres[0] + 2 * Math.PI
                const range = (h: number): [number, number] => {
                    const from = Math.max(centre + halfSpan(h), within[0])
                    const to = Math.min(next - halfSpan(h), within[1])
                    return [from, to]
                }
                const [lowFrom, lowTo] = range(height)
                const [highFrom, highTo] = range(top)
                if (lowTo <= lowFrom || highTo <= highFrom) return []
                return [
                    {
                        d: polygon([
                            ...arc(height, lowFrom, lowTo),
                            ...arc(top, highFrom, highTo).toReversed()
                        ]),
                        level: level(profile(middle).facing)
                    }
                ]
            })
        })
    const rimFrom = THICKNESS - RIM_ROUND
    const front: [number, number] = [Math.PI, 2 * Math.PI + Math.PI / 6]
    const back: [number, number] = [Math.PI / 6 - 0.4, Math.PI + 0.4]
    const side = [
        ...bands(
            SIDE_HEIGHTS.filter((height) => height >= rimFrom),
            back
        ),
        ...bands(SIDE_HEIGHTS, front)
    ]
    // A notch's outline in the top: in from well past the rim, round its rounded end, and out.
    const topCuts = centres.map((centre) => {
        const along = { u: Math.cos(centre), v: Math.sin(centre) }
        const across = { u: -Math.sin(centre), v: Math.cos(centre) }
        const point = (out: number, sideways: number) =>
            flat(along.u * out + across.u * sideways, along.v * out + across.v * sideways)
        const round = Array.from({ length: 49 }, (_, step) => {
            const turn = (Math.PI * step) / 48
            return point(end - Math.sin(turn) * w, Math.cos(turn) * w)
        })
        return polygon([point(1.2, w), ...round, point(1.2, -w)])
    })
    const walls = centres.flatMap((centre) => notchWalls(flat, (centre * 180) / Math.PI, tone))
    return { kind: 'cuts', side, topCuts, walls, outline: discOutline(view, radius) }
}

// YINSH's channel: a groove with the ring groove's profile, from the ring groove, where the two run
// together, to a rounded end, centred YINSH_OFFSET towards the far side. Its straight run is drawn
// as strips along it, each starting where it meets the ring groove's inner wall; its end as rings
// round the end's centre, as the ring groove is drawn round the disc's. All are seen only through
// its opening, so its near lip hides what lies behind it.
function yinshChannel(view: BoardView, radius: number, tone: Tone): Mark {
    const flat = onFlat(view, radius)
    const w = YINSH_HALF_WIDTH
    const end = YINSH_END - w
    const across = { outer: w, inner: -w }
    const profile = (distance: number) => THICKNESS - grooveDepth(Math.abs(distance), across)
    const ring = (u: number, v: number) => topProfile(PieceKind.Yinsh, Math.hypot(u, v))
    const lineDistance = (u: number, v: number) =>
        Math.hypot(Math.max(0, u - end), v - YINSH_OFFSET)
    const height = (u: number, v: number) => Math.min(ring(u, v), profile(lineDistance(u, v)))
    const span = (lo: number, hi: number, count: number) =>
        Array.from({ length: count + 1 }, (_, step) => lo + ((hi - lo) * step) / count)

    // Where a strip at a height comes out of the ring groove's inner wall, searched from the
    // middle of the groove's floor, where the two are equally deep.
    const meetsRing = (v: number, h: number) => {
        let [lo, hi] = [-(TROUGH.outer + TROUGH.inner) / 2, -TROUGH.inner + 0.01]
        for (let step = 0; step < 30; step++) {
            const mid = (lo + hi) / 2
            if (ring(mid, v) <= h + 1e-6) lo = mid
            else hi = mid
        }
        return lo
    }
    // Neighbouring pieces overlap this much, so no seam shows between them.
    const overlap = 0.003
    const edges = span(-w, w, YINSH_STRIPS)
    const strips = edges.slice(0, -1).map((from, index) => {
        const to = edges[index + 1]
        const [v0, v1] = [YINSH_OFFSET + from - overlap, YINSH_OFFSET + to + overlap]
        return [
            { u: meetsRing(v0, profile(from)), v: v0 },
            { u: end, v: v0 },
            { u: end, v: v1 },
            { u: meetsRing(v1, profile(to)), v: v1 }
        ]
    })
    const radii = span(w, 0, YINSH_STRIPS / 2)
    const turns = span(-Math.PI / 2, Math.PI / 2, YINSH_TURNS)
    const point = (rho: number, phi: number) => ({
        u: end + rho * Math.cos(phi),
        v: YINSH_OFFSET + rho * Math.sin(phi)
    })
    const cap = radii.slice(0, -1).flatMap((outer, i) =>
        turns.slice(0, -1).map((turn, j) => {
            const [r0, r1] = [outer + overlap, Math.max(0, radii[i + 1] - overlap)]
            const [p0, p1] = [turn - 0.01, turns[j + 1] + 0.01]
            return [point(r0, p0), point(r0, p1), point(r1, p1), point(r1, p0)]
        })
    )
    const outline = [
        flat(-(TROUGH.outer + TROUGH.inner) / 2, YINSH_OFFSET + w),
        ...turns.map((turn) => flat(end + w * Math.cos(turn), YINSH_OFFSET - w * Math.sin(turn))),
        flat(-(TROUGH.outer + TROUGH.inner) / 2, YINSH_OFFSET - w)
    ]
    return {
        kind: 'carved',
        clip: polygon(outline),
        cells: shadedQuads(flat, tone, [...strips, ...cap], height)
    }
}

// Quads of a carved surface on the disc, each shaded at its middle, far ones first, leaving out
// those that face away.
function shadedQuads(
    flat: (u: number, v: number, height?: number) => Point,
    tone: Tone,
    quads: { u: number; v: number }[][],
    height: (u: number, v: number) => number
): Strip[] {
    return quads
        .flatMap((corners) => {
            const u = corners.reduce((sum, corner) => sum + corner.u, 0) / corners.length
            const v = corners.reduce((sum, corner) => sum + corner.v, 0) / corners.length
            const fill = shadeAt(tone, height, u, v)
            if (fill === undefined) return []
            const d = polygon(corners.map((c) => flat(c.u, c.v, height(c.u, c.v))))
            return [{ d, fill, opacity: 1, depth: v }]
        })
        .toSorted((p, q) => q.depth - p.depth)
        .map(({ d, fill, opacity }) => ({ d, fill, opacity }))
}

// A carved surface's colour at a point: by its depth, and by its slope, in shade facing you and
// lit facing away, as GIPF's trough; rising to the right, it faces the light, which comes from
// the left as on the pieces' sides. Undefined where it faces away, out of sight.
function shadeAt(
    tone: Tone,
    height: (u: number, v: number) => number,
    u: number,
    v: number
): string | undefined {
    const { flat: top, floor } = TOP_PALETTE[tone]
    const { farWall, nearWall } = NOTCH_WALLS[tone]
    const step = 0.004
    const slope = (height(u, v + step) - height(u, v - step)) / (2 * step)
    if (slope < FACING_AWAY_SLOPE) return undefined
    const lateral = (height(u + step, v) - height(u - step, v)) / (2 * step)
    const base = mix(top, floor, Math.min(1, (THICKNESS - height(u, v)) / TROUGH_DEPTH))
    const steep = Math.min(1, Math.abs(slope) / 1.2) * 0.7
    const facing = slope > 0 ? mix(base, farWall, steep) : mix(base, nearWall, steep)
    const side = Math.min(1, Math.abs(lateral) / 1.2) * 0.5
    return css(mix(facing, lateral > 0 ? nearWall : farWall, side))
}

// The part of the opening above the trough's floor, between the points where the opening and the
// floor's outer edge, lower by the depth, cross.
function farWall({ y, rx, ry }: Ellipse, depth: number): string {
    const x = rx * Math.sqrt(Math.max(0, 1 - (depth / (2 * ry)) ** 2))
    const mid = y + depth / 2
    return `M ${-x} ${mid} A ${rx} ${ry} 0 1 1 ${x} ${mid} A ${rx} ${ry} 0 0 0 ${-x} ${mid} Z`
}

// Where a hole's top opening and bottom opening overlap: the board shows straight through.
function lens({ y, rx, ry }: Ellipse, depth: number): string {
    const x = rx * Math.sqrt(Math.max(0, 1 - (depth / (2 * ry)) ** 2))
    const mid = y + depth / 2
    return `M ${-x} ${mid} A ${rx} ${ry} 0 0 0 ${x} ${mid} A ${rx} ${ry} 0 0 0 ${-x} ${mid} Z`
}

type Rgb = [number, number, number]

const PALETTE: Record<Tone, { lit: Rgb; shaded: Rgb }> = {
    light: { lit: [236, 229, 204], shaded: [120, 111, 86] },
    dark: { lit: [70, 65, 66], shaded: [0, 0, 0] }
}

function mix(from: Rgb, to: Rgb, amount: number): Rgb {
    const [r, g, b] = from.map((value, index) => value + (to[index] - value) * amount)
    return [r, g, b]
}

function css(rgb: Rgb, brightness = 1): string {
    const [r, g, b] = rgb.map((value) => Math.round(Math.min(255, value * brightness)))
    return `rgb(${r} ${g} ${b})`
}

// The top's colour, and its floor's in a groove. The walls' shades are in PieceDefs.
const NOTCH_WALLS: Record<Tone, { farWall: Rgb; nearWall: Rgb }> = {
    light: { farWall: [172, 162, 128], nearWall: [226, 219, 194] },
    dark: { farWall: [8, 7, 7], nearWall: [74, 68, 70] }
}

const TOP_PALETTE: Record<Tone, { flat: Rgb; floor: Rgb }> = {
    light: { flat: [236, 230, 208], floor: [207, 198, 166] },
    dark: { flat: [44, 40, 41], floor: [16, 14, 15] }
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
