import { PieceKind, POTENTIAL_KINDS, type PotentialKind } from '@tabletop/gipf-potentials'
import type { BoardView } from './geometry.js'
import type { Point } from '@tabletop/common'
import { hull } from './hull.js'

// A GIPF project piece, as the published ones are: a thin plastic disc with rounded edges and a
// flat top, with a circular groove set in from the edge, its lips rounded down to a rounded
// floor. A ring on the underside fits the groove of the piece below. The potentials are the same
// disc with their game's mark: TAMSK a second ring inside the trough, ZÈRTZ three notches across the rim, DVONN a hole through the middle,
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

// One disc of a stack, bottom up, its mark turned round by `turn` steps of TURN_STEP degrees
// (none when left out).
export type Disc = { tone: Tone; kind: DiscKind; turn?: number }

// What a disc is: plain, as a basic piece and each half of a GIPF-piece are, or a potential.
export type DiscKind = PieceKind.Basic | PotentialKind
export const DISC_KINDS: readonly DiscKind[] = [PieceKind.Basic, ...POTENTIAL_KINDS]

export const TONES: readonly Tone[] = ['light', 'dark']

// Discs lie on the board turned every which way, in twelfths of a turn.
const TURN_STEP = 30
// The different ways round each kind's mark can lie: ZÈRTZ's three notches look the same again
// after a third of a turn, PÜNCT's six after a sixth; plain and round marks after none.
const TURNS: Record<DiscKind, number> = {
    [PieceKind.Basic]: 1,
    [PieceKind.Tamsk]: 1,
    [PieceKind.Zertz]: 4,
    [PieceKind.Dvonn]: 1,
    [PieceKind.Yinsh]: 12,
    [PieceKind.Punct]: 2
}

// Which way round a disc lies, from its id, so it lies the same way wherever it goes and whoever
// looks. A disc with no id lies unturned.
export function turnOf(kind: DiscKind, id: number | undefined): number {
    if (id === undefined) return 0
    // Ids count up one by one; mixed, neighbours lie unrelated ways round.
    let hash = Math.imul(id ^ (id >>> 16), 0x85ebca6b)
    hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35)
    hash ^= hash >>> 16
    return (hash >>> 0) % TURNS[kind]
}

// Every disc there is: each kind in each tone, each way round its mark can lie.
export const DISC_LOOKS: readonly Disc[] = TONES.flatMap((tone) =>
    DISC_KINDS.flatMap((kind) =>
        Array.from({ length: TURNS[kind] }, (_, turn) => ({ tone, kind, turn }))
    )
)

// A disc's look's name: the file it is pre-rendered to (see scripts/render-looks.mjs).
export function lookName(disc: Disc): string {
    return `${disc.tone}-${disc.kind}-${disc.turn ?? 0}`
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
const STACK_GAP = THICKNESS * 0.24
// Distances from the centre where the groove's lips start down, and its depth.
const TROUGH = { outer: 0.84, inner: 0.62 }
const TROUGH_DEPTH = THICKNESS * 0.4
// How much of each side of a groove is its rounded wall; the rest is its floor.
const GROOVE_WALL = 0.42
// Slices up the side, and the side's shades: as with the grooves' bands, fine enough that no
// step shows once the look is scaled down.
const SLICES = 48
const TOP_RADIUS = 1 - RIM_ROUND * 0.6
// Bands across each groove: enough that their shades step too finely to see. The seams between
// so many would show as fine lines, but the looks are drawn larger and scaled down, which blends
// them away (scripts/render-looks.mjs).
const GROOVE_BANDS = 60

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
const ZERTZ_ALONG = 24
// Rows from the ring groove's edge out to where the notch leaves the disc.
const ZERTZ_MOUTH_ROWS = 4
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
// How far the edge where it cuts through the ring groove's wall is rounded off (as a smooth
// minimum's width), reached once both cuts are this deep.
const YINSH_ROUND = 0.05
const YINSH_ROUND_IN = 0.01
// Cells along and across it, for its shading, and steps round its rounded end.
const YINSH_ALONG = 240
const YINSH_ACROSS = 104
// How far past the channel's sides its mouth on the far side is drawn: where the channel slants,
// the top it cut away had hidden the groove's inner wall beside it, which shows now.
const YINSH_MOUTH_SPILL = 0.1
const YINSH_TURNS = 48
// PÜNCT's notches cut into the edge, all the way down: half circles centred on the edge, about
// as wide as the rim between the edge and the ring groove.
const PUNCT_NOTCHES = 6
const PUNCT_RADIUS = 0.15

// The angles of PÜNCT's notches round a disc turned a number of steps.
function punctCentres(turn: number): number[] {
    return Array.from(
        { length: PUNCT_NOTCHES },
        (_, index) => (((360 / PUNCT_NOTCHES) * (index + 0.5) + TURN_STEP * turn) * Math.PI) / 180
    )
}
// Strips round each notch's inside, for its shading.
const PUNCT_WALL_STRIPS = 48

// How many shades a slice can take, from facing straight down to facing straight up.
export const SHADE_LEVELS = 33

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

// A part of a disc cut through its edge: a band of its side, or a strip of a cut's inside.
export type CutPart = SideBand | Strip

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
    | {
          kind: 'carved'
          clip: string
          cells: Strip[]
          // The top drawn again over the cells but for the opening, where they show more than
          // the opening.
          cover?: { top: string; opening: string; fill: string }
      }
    | { kind: 'cuts'; parts: CutPart[]; topCuts: string[]; outline: string }

export type PieceDrawing = {
    slices: Slice[]
    // How far up the screen each disc stands, from the bottom up.
    bases: number[]
}

// Heights up the side, through its rounded corners, at which a cut through the side follows it.
const SIDE_HEIGHTS = Array.from({ length: SLICES + 1 }, (_, step) => (THICKNESS * step) / SLICES)

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
        bases: discBases(discs).map((base) => -view.height(base * radius))
    }
}

// The top of a disc with another on it, in that one's shadow, where the crease shows: PÜNCT's
// with its notches left open, so the notches run on down through the stack.
export function creaseOf(view: BoardView, disc: Disc, radius: number): string {
    const flat = onFlat(view, radius)
    const notches = disc.kind === PieceKind.Punct ? punctCentres(disc.turn ?? 0) : []
    // How far out the top reaches at an angle: to its rounded edge, or in to a notch's circle,
    // where the angle points towards the notch and crosses it.
    const reach = (turn: number) =>
        notches.reduce((nearest, centre) => {
            const along = Math.cos(turn - centre)
            const inside = along ** 2 - 1 + PUNCT_RADIUS ** 2
            return along > 0 && inside > 0 ? Math.min(nearest, along - Math.sqrt(inside)) : nearest
        }, TOP_RADIUS)
    return polygon(
        Array.from({ length: 360 }, (_, step) => {
            const turn = (step * Math.PI) / 180
            const out = reach(turn)
            return flat(out * Math.cos(turn), out * Math.sin(turn))
        })
    )
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

// The part of a PÜNCT notch's inside that faces you, in narrow strips round it, each shaded by
// the way it faces: lit facing the light, from the left, in shade facing away from it. At each
// height up the side the strips span only the notch's circle inside the disc there, ending where
// the side's circle crosses it, as the side's bands beside it do, so its edges follow the disc's
// rounded ones and meet the side's with no gap.
function notchWalls(
    flat: (u: number, v: number, height?: number) => Point,
    centre: number,
    tone: Tone
): Strip[] {
    const along = { u: Math.cos(centre), v: Math.sin(centre) }
    const across = { u: -Math.sin(centre), v: Math.cos(centre) }
    const r = PUNCT_RADIUS
    const at = (point: [number, number], height: number) =>
        flat(
            along.u * point[0] + across.u * point[1],
            along.v * point[0] + across.v * point[1],
            height
        )
    // Round from one lip, in to the notch's deepest point and out to the other.
    const point = (t: number): [number, number] => [1 - Math.sin(t) * r, Math.cos(t) * r]
    // How far round from either lip the notch's circle lies outside the side at a height.
    const lipAt = (height: number) => {
        const side = profile(height).radius
        return Math.asin(Math.min(1, (1 + r * r - side * side) / (2 * r)))
    }
    // Up the side as its bands go, and a little past the top, under its cut edge, so no seam
    // shows there.
    const lip = THICKNESS * 0.03
    const heights = [
        ...SIDE_HEIGHTS.map((height) => ({ height, at: height })),
        {
            height: THICKNESS + lip,
            at: THICKNESS
        }
    ]
    // At a height, a fraction of the way round the part inside the disc.
    const turnAt = (at: number, across: number) => {
        const from = lipAt(at)
        return from + (Math.PI - 2 * from) * across
    }
    const step = 1 / PUNCT_WALL_STRIPS
    return Array.from({ length: PUNCT_WALL_STRIPS }, (_, index) => index * step).flatMap((from) => {
        const middle = turnAt(THICKNESS / 2, from + step / 2)
        // The inside faces the notch's middle.
        const normal = {
            u: along.u * Math.sin(middle) - across.u * Math.cos(middle),
            v: along.v * Math.sin(middle) - across.v * Math.cos(middle)
        }
        if (normal.v >= 0) return []
        // Each strip reaches a little into the next, so no seam shows between them; not past
        // the lips, where the side goes on.
        const overlap = step * 0.3
        const left = Math.max(0, from - overlap)
        const right = Math.min(1, from + step + overlap)
        return [
            {
                d: polygon([
                    ...heights.map(({ height, at: h }) => at(point(turnAt(h, left)), height)),
                    ...heights
                        .toReversed()
                        .map(({ height, at: h }) => at(point(turnAt(h, right)), height))
                ]),
                fill: wallShade(tone, normal),
                opacity: 1
            }
        ]
    })
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
    {
        carveMin = CARVE_MIN,
        behind,
        colorAt = (u, v) => shadeAt(tone, height, u, v),
        uncut = () => false,
        opaque = false
    }: {
        carveMin?: number
        // The colour of what shows behind a cell that faces away, if not left out.
        behind?: string
        // A cell's colour, if not shadeAt's, given how deep it is cut.
        colorAt?: (u: number, v: number, carve: number) => string | undefined
        // Where a cell is drawn though it is not cut.
        uncut?: (u: number, v: number) => boolean
        // Every cell drawn whole, its colour fading into the surface it was cut from by
        // colorAt instead: what lies beneath may not be that surface, and overlapping cells
        // would show where they overlap.
        opaque?: boolean
    } = {}
): Strip[] {
    const cells: (Strip & { depth: number })[] = []
    for (let i = 0; i < grid.length - 1; i++) {
        for (let j = 0; j < grid[i].length - 1; j++) {
            const corners = [grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]]
            const heights = corners.map(({ u, v }) => height(u, v))
            // A blend rounds two equal heights down a little; only a real cut is drawn.
            const carve = Math.max(...corners.map(({ u, v }, k) => untouched(u, v) - heights[k]))
            const u = corners.reduce((sum, corner) => sum + corner.u, 0) / 4
            const v = corners.reduce((sum, corner) => sum + corner.v, 0) / 4
            if (carve <= carveMin && !uncut(u, v)) continue
            const color = colorAt(u, v, carve) ?? behind
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
                opacity: opaque ? 1 : Math.min(1, carve / CARVE_FADE),
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
    // Towards you, or out to the side, where the disc's outline runs past it; turned further
    // away, the board shows through it above its profile.
    const facesYou = along.v < 0.4
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

    const width = filletCentre
    const sides = Array.from(
        { length: ZERTZ_ACROSS + 1 },
        (_, step) => -width + (2 * width * step) / ZERTZ_ACROSS
    )
    // Where the notch leaves the disc: facing you, through the side where the disc is solid at
    // the notch's height, which is further in towards its lips, where the edge rounds over.
    const mouth = (side: number) => (facesYou ? profile(notch(side)).radius : reach)
    // Rows across the notch, each a distance out at every point across: through the groove,
    // then on out to the mouth.
    const rows = [
        ...Array.from(
            { length: ZERTZ_ALONG },
            (_, step) => () => ZERTZ_FROM + ((TROUGH.outer - ZERTZ_FROM) * step) / ZERTZ_ALONG
        ),
        ...Array.from(
            { length: ZERTZ_MOUTH_ROWS + 1 },
            (_, step) => (side: number) =>
                TROUGH.outer + ((mouth(side) - TROUGH.outer) * step) / ZERTZ_MOUTH_ROWS
        )
    ]
    const toFlat = (out: number, side: number) => ({
        u: along.u * out + across.u * side,
        v: along.v * out + across.v * side
    })
    const outOf = (u: number, v: number) => u * along.u + v * along.v
    const sideOf = (u: number, v: number) => u * across.u + v * across.v
    const cells = carvedCells(
        flat,
        tone,
        rows.map((row) => sides.map((side) => toFlat(row(side), side))),
        (u, v) => surface(outOf(u, v), sideOf(u, v)),
        (u, v) => groove(outOf(u, v)),
        // Every cell the notch lowers, however little, so its lips round smoothly into the top.
        { carveMin: 1e-5 }
    )
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
        ...sides.toReversed().map((side) => at(mouth(side), side, notch(side))),
        at(rim, -width, THICKNESS)
    ])
    // On the far side the rim is open above the notch's profile, where the board shows through.
    const beyond = polygon([
        at(1.3, width, THICKNESS),
        ...sides.toReversed().map((side) => at(reach, side, notch(side))),
        at(1.3, -width, THICKNESS)
    ])
    return {
        // Facing you, nothing is cut: the backing and the notch's surface cover all it takes
        // away, and a cut's soft edge under them showed as a seam.
        through: facesYou ? [] : [beyond],
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

export function markOf(view: BoardView, disc: Disc, radius: number): Mark | undefined {
    const { kind, tone } = disc
    const turn = disc.turn ?? 0
    switch (kind) {
        case PieceKind.Zertz: {
            const notches = ZERTZ_ANGLES.map((angle) =>
                rimNotch(view, radius, angle + TURN_STEP * turn, tone)
            )
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
            return yinshChannel(view, radius, tone, turn)
        case PieceKind.Punct:
            return punctNotches(view, radius, tone, turn)
        default:
            return undefined
    }
}

// Where a ring drawn round a disc's top, `at` out from its centre over the radius, would cross its
// mark: the angles either side of each crossing (anticlockwise as you look, 0 to the right). A
// mark is a straight cut along an angle, `off` to its left of the centre, `from` to `to` along.
export function markGaps(disc: Disc, at: number): [number, number][] {
    const turn = (TURN_STEP * (disc.turn ?? 0) * Math.PI) / 180
    const cuts: { angle: number; off: number; from: number; to: number; half: number }[] = []
    switch (disc.kind) {
        case PieceKind.Zertz:
            for (const angle of ZERTZ_ANGLES) {
                const half = ZERTZ_RADIUS + ZERTZ_LIP
                cuts.push({
                    angle: (angle * Math.PI) / 180 + turn,
                    off: 0,
                    from: ZERTZ_FROM,
                    to: 2,
                    half
                })
            }
            break
        case PieceKind.Yinsh:
            cuts.push({
                angle: turn,
                off: YINSH_OFFSET,
                from: -(TROUGH.outer + TROUGH.inner) / 2,
                to: YINSH_END,
                half: YINSH_HALF_WIDTH
            })
            break
        case PieceKind.Punct:
            for (const angle of punctCentres(disc.turn ?? 0)) {
                cuts.push({ angle, off: 0, from: 1 - PUNCT_RADIUS, to: 2, half: PUNCT_RADIUS })
            }
            break
    }
    return cuts.flatMap(({ angle, off, from, to, half }) => {
        if (at <= Math.abs(off)) return []
        const along = Math.sqrt(at ** 2 - off ** 2)
        const span = Math.asin(Math.min(1, (half + GAP_MARGIN) / at))
        return [along, -along]
            .filter((distance) => distance >= from && distance <= to)
            .map((distance): [number, number] => {
                const centre = angle + Math.atan2(off, distance)
                return [centre - span, centre + span]
            })
    })
}
// How far a ring stops short of a mark's edge, over the radius.
const GAP_MARGIN = 0.05

// PÜNCT's notches, cut through the edge from top to board. The disc's side is built from bands
// of side between the notches rather than drawn whole and cut, so each notch's edges are exact at
// every height: the front of the side, bottom up, and the rim behind, where it rounds over above
// the top. Only the top is cut, by each notch's outline reaching well past the rim. The side's
// bands and the notches' insides are drawn from the far side round to the near, so a notch's
// inside shows in front of the side beyond it and behind the side nearer you.
function punctNotches(view: BoardView, radius: number, tone: Tone, turn: number): Mark {
    const flat = onFlat(view, radius)
    const r = PUNCT_RADIUS
    const centres = punctCentres(turn)
    // How far round from its centre a notch reaches into the side at a height: where the side's
    // circle there crosses the notch's circle.
    const halfSpan = (height: number) => {
        const side = profile(height).radius
        return Math.acos(Math.min(1, (side * side + 1 - r * r) / (2 * side)))
    }
    const arc = (height: number, from: number, to: number) => {
        const side = profile(height).radius
        const steps = Math.max(2, Math.ceil((to - from) / ((2 * Math.PI) / 360)))
        return Array.from({ length: steps + 1 }, (_, step) => {
            const turn = from + ((to - from) * step) / steps
            return flat(side * Math.cos(turn), side * Math.sin(turn), height)
        })
    }
    // How far away a part lies, at an angle round the disc: the far side first.
    type Placed = { part: CutPart; away: number }
    // The side between each notch and the next, within the angles given, at each pair of heights.
    // Each band reaches a little up into the next, drawn after it, so no seam shows.
    const bands = (heights: readonly number[], within: [number, number]): Placed[] =>
        heights.slice(0, -1).flatMap((height, index) => {
            const top = Math.min(THICKNESS, heights[index + 1] + THICKNESS * 0.01)
            const middle = (height + heights[index + 1]) / 2
            // Each stretch, and the same a whole turn either way, as the angles given may run
            // past a full turn.
            const stretches = centres.flatMap((centre, k) => {
                const next = k + 1 < centres.length ? centres[k + 1] : centres[0] + 2 * Math.PI
                return [-2 * Math.PI, 0, 2 * Math.PI].map((shift) => [centre + shift, next + shift])
            })
            return stretches.flatMap(([centre, next]) => {
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
                        part: {
                            d: polygon([
                                ...arc(height, lowFrom, lowTo),
                                ...arc(top, highFrom, highTo).toReversed()
                            ]),
                            level: level(profile(middle).facing)
                        },
                        // The same at every height, so a stretch's bands stay bottom up.
                        away: Math.sin(
                            (Math.max(centre, within[0]) + Math.min(next, within[1])) / 2
                        )
                    }
                ]
            })
        })
    const rimFrom = THICKNESS - RIM_ROUND
    const front: [number, number] = [Math.PI, 2 * Math.PI + Math.PI / 6]
    const back: [number, number] = [Math.PI / 6 - 0.4, Math.PI + 0.4]
    const walls = centres.flatMap((centre) =>
        notchWalls(flat, centre, tone).map((part) => ({ part, away: Math.sin(centre) }))
    )
    // Sorted stably, so each stretch's bands stay bottom up.
    const parts = [
        ...bands(
            SIDE_HEIGHTS.filter((height) => height >= rimFrom),
            back
        ),
        ...bands(SIDE_HEIGHTS, front),
        ...walls
    ]
        .toSorted((a, b) => b.away - a.away)
        .map(({ part }) => part)
    // A notch's outline in the top: in from well past the rim, round its rounded end, and out.
    const topCuts = centres.map((centre) => {
        const along = { u: Math.cos(centre), v: Math.sin(centre) }
        const across = { u: -Math.sin(centre), v: Math.cos(centre) }
        const point = (out: number, sideways: number) =>
            flat(along.u * out + across.u * sideways, along.v * out + across.v * sideways)
        const round = Array.from({ length: 49 }, (_, step) => {
            const turn = (Math.PI * step) / 48
            return point(1 - Math.sin(turn) * r, Math.cos(turn) * r)
        })
        return polygon([point(1.2, r), ...round, point(1.2, -r)])
    })
    return { kind: 'cuts', parts, topCuts, outline: discOutline(view, radius) }
}

// YINSH's channel: a groove with the ring groove's profile, from the ring groove to a rounded end,
// centred YINSH_OFFSET towards the far side. Where its walls cut through the ring groove's inner
// wall, the edge between them is rounded off. Drawn as cells over a grid, as ZÈRTZ's notches
// are, with the groove's floor in its mouth too, so that turned to the far side the groove shows
// through there rather than the top; all seen only through its opening, so its near lip hides
// what lies behind it. It is laid out unturned, running in from the left, then turned round the
// disc's centre.
function yinshChannel(view: BoardView, radius: number, tone: Tone, turn: number): Mark {
    const flat = onFlat(view, radius)
    const angle = (TURN_STEP * turn * Math.PI) / 180
    const [cos, sin] = [Math.cos(angle), Math.sin(angle)]
    const turned = ({ u, v }: { u: number; v: number }) => ({
        u: u * cos - v * sin,
        v: u * sin + v * cos
    })
    // A function of the channel's own frame, read where it lies on the disc.
    const onDisc =
        <T>(f: (u: number, v: number) => T) =>
        (u: number, v: number) =>
            f(u * cos + v * sin, v * cos - u * sin)
    const w = YINSH_HALF_WIDTH
    const end = YINSH_END - w
    const across = { outer: w, inner: -w }
    const ring = (u: number, v: number) => topProfile(PieceKind.Yinsh, Math.hypot(u, v))
    const lineDistance = (u: number, v: number) =>
        Math.hypot(Math.max(0, u - end), v - YINSH_OFFSET)
    // How deep each cut is, and how widely they are rounded where they meet: only where both cut,
    // and gently in from their lips, so the top stays flat round them.
    const cuts = (u: number, v: number) => {
        const ringDepth = THICKNESS - ring(u, v)
        const channelDepth = grooveDepth(lineDistance(u, v), across)
        const round = YINSH_ROUND * Math.min(1, Math.min(ringDepth, channelDepth) / YINSH_ROUND_IN)
        return { ringDepth, channelDepth, round }
    }
    // The deeper of the two cuts, rounded where they meet; never below their floor, which the
    // rounding would dimple where the two floors meet.
    const height = (u: number, v: number) => {
        const { ringDepth, channelDepth, round } = cuts(u, v)
        return round > 0
            ? Math.max(
                  THICKNESS - TROUGH_DEPTH,
                  THICKNESS + smoothMin(-ringDepth, -channelDepth, round)
              )
            : THICKNESS - Math.max(ringDepth, channelDepth)
    }
    // The top as it was before the channel, but in its mouth on the far side the ring groove's
    // inner wall and floor, which face away or lie behind the ring's inner lip, so the top's bands
    // drew the lip there: cut from the top, they are drawn whole rather than fading into it. On
    // the near side the top's own bands show them.
    const onFloor = (u: number, v: number) => {
        const distance = Math.hypot(u, v)
        return (
            u * sin + v * cos > 0 &&
            distance > TROUGH.inner &&
            (distance <= (TROUGH.inner + TROUGH.outer) / 2 ||
                grooveDepth(distance, TROUGH) >= TROUGH_DEPTH - 1e-9) &&
            lineDistance(u, v) < w
        )
    }
    const before = (u: number, v: number) => (onFloor(u, v) ? THICKNESS : ring(u, v))
    // Round the far mouth, where the channel uncovered the groove's inner wall beside it, drawn
    // whole; where the top is still in front of it, the top is drawn again over it (cover).
    const uncovered = (u: number, v: number) => {
        const distance = Math.hypot(u, v)
        return (
            onFloor(u, v) ||
            (u * sin + v * cos > 0 &&
                distance > TROUGH.inner &&
                distance <= (TROUGH.inner + TROUGH.outer) / 2 &&
                lineDistance(u, v) < w + YINSH_MOUTH_SPILL)
        )
    }
    const span = (lo: number, hi: number, count: number) =>
        Array.from({ length: count + 1 }, (_, step) => lo + ((hi - lo) * step) / count)
    // Shaded as the ring groove's bands round it where the ring groove's walls are what shows, as
    // a carving where the channel's are, and blended across the rounded crease between them, so
    // the crease shades as the walls either side of it do; where the channel faces away, the
    // groove's floor beyond. Barely cut, it fades into the bands' shade of the surface it was cut
    // from, so the carving's edge is soft rather than stepped.
    const colorAt = (u: number, v: number, carve: number) => {
        const at = turned({ u, v })
        const band = bandShade(tone, PieceKind.Yinsh, at.u, at.v)
        const carved = carvedShade(tone, onDisc(height), at.u, at.v)
        const { ringDepth, channelDepth, round } = cuts(u, v)
        const deeper = channelDepth - ringDepth
        const channel =
            round > 0 ? Math.min(1, Math.max(0, 0.5 + deeper / (2 * round))) : deeper >= 0 ? 1 : 0
        const shade = mix(band, carved ?? TOP_PALETTE[tone].floor, channel)
        const fade = onFloor(u, v) ? 1 : Math.min(1, carve / CARVE_FADE)
        return css(mix(band, shade, fade))
    }

    const mouth = -(TROUGH.outer + TROUGH.inner) / 2
    const reach = w + YINSH_MOUTH_SPILL + 0.02
    const grid = span(mouth, YINSH_END + 0.01, YINSH_ALONG).map((u) =>
        span(YINSH_OFFSET - reach, YINSH_OFFSET + reach, YINSH_ACROSS).map((v) => turned({ u, v }))
    )
    const turns = span(-Math.PI / 2, Math.PI / 2, YINSH_TURNS)
    // The edge of what is drawn, on each side, at its own height: in from the lip to where the
    // channel first cuts below the top or the ring groove's wall, so the cells' stepped edges are
    // trimmed to a smooth line. With the mouth on the far side, wide enough for the wall it
    // uncovered; the top drawn over it again trims the channel's edges there instead.
    const farMouth = mouth * sin > 0
    const side = farMouth ? w + YINSH_MOUTH_SPILL : w
    const edgeRun = (way: number) =>
        span(mouth, end, YINSH_ALONG).map((u) => {
            const steps = 200
            let off = 0
            for (let step = 0; step <= steps; step++) {
                const at = side * (1 - step / steps)
                const v = YINSH_OFFSET + way * at
                if (farMouth || before(u, v) - height(u, v) > 1e-5) {
                    off = at
                    break
                }
            }
            const v = YINSH_OFFSET + way * off
            return { u, v, h: height(u, v) }
        })
    // Out past the mouth, where no cell is drawn, at the groove's floor: closed across the mouth
    // itself, the outline would trim the cells that open into the groove.
    const beyond = (side: number) => ({
        u: mouth - 0.1,
        v: YINSH_OFFSET + side * w,
        h: THICKNESS - TROUGH_DEPTH
    })
    const outline = [
        beyond(1),
        ...edgeRun(1),
        ...turns.map((turn) => ({
            u: end + side * Math.cos(turn),
            v: YINSH_OFFSET - side * Math.sin(turn),
            h: THICKNESS
        })),
        ...edgeRun(-1).toReversed(),
        beyond(-1)
    ].map(({ h, ...point }) => ({ ...turned(point), h }))
    // The channel's opening in the top, at the top's height.
    const opening = [
        { u: mouth - 0.1, v: YINSH_OFFSET + w },
        { u: end, v: YINSH_OFFSET + w },
        ...turns.map((turn) => ({
            u: end + w * Math.cos(turn),
            v: YINSH_OFFSET - w * Math.sin(turn)
        })),
        { u: mouth - 0.1, v: YINSH_OFFSET - w }
    ].map((point) => turned(point))
    const top = flatEllipse(view, radius)(THICKNESS, TROUGH.inner)
    return {
        kind: 'carved',
        clip: polygon(outline.map(({ u, v, h }) => flat(u, v, h))),
        cover: farMouth
            ? {
                  top: `M ${-top.rx} ${top.y} A ${top.rx} ${top.ry} 0 1 1 ${top.rx} ${top.y} A ${top.rx} ${top.ry} 0 1 1 ${-top.rx} ${top.y} Z`,
                  opening: polygon(opening.map(({ u, v }) => flat(u, v))),
                  fill: css(TOP_PALETTE[tone].flat)
              }
            : undefined,
        cells: carvedCells(flat, tone, grid, onDisc(height), onDisc(before), {
            carveMin: 1e-5,
            colorAt: (u, v, carve) => {
                const at = { u: u * cos + v * sin, v: v * cos - u * sin }
                return colorAt(at.u, at.v, carve)
            },
            uncut: onDisc(uncovered),
            opaque: true
        })
    }
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
    const shade = carvedShade(tone, height, u, v)
    return shade && css(shade)
}

function carvedShade(
    tone: Tone,
    height: (u: number, v: number) => number,
    u: number,
    v: number
): Rgb | undefined {
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
    return mix(facing, lateral > 0 ? nearWall : farWall, side)
}

// The colour the top's bands give a point of a disc's top (topBands, with LookDefs' wall
// gradients over them): by its depth, and on a steep wall in shade on the far half of the disc,
// catching the light on the near half, most at the far and near points, none at the sides.
function bandShade(tone: Tone, kind: PieceKind, u: number, v: number): Rgb {
    const { flat, floor } = TOP_PALETTE[tone]
    const distance = Math.max(1e-6, Math.hypot(u, v))
    const height = topProfile(kind, distance)
    const step = 0.004
    const slope =
        Math.abs(topProfile(kind, distance + step) - topProfile(kind, distance - step)) / (2 * step)
    const steep = Math.min(1, slope / 0.6)
    const base = mix(flat, floor, Math.min(1, (THICKNESS - height) / TROUGH_DEPTH))
    const away = v / distance
    const { farWall, nearWall } = NOTCH_WALLS[tone]
    return away > 0 ? mix(base, farWall, steep * away) : mix(base, nearWall, -steep * away)
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

// The colours walls carved into the top are shaded towards, in shade or catching the light: the
// grooves' (through LookDefs' gradients over the top's bands) and the carved marks'.
const NOTCH_WALLS: Record<Tone, { farWall: Rgb; nearWall: Rgb }> = {
    light: { farWall: [172, 162, 128], nearWall: [226, 219, 194] },
    dark: { farWall: [8, 7, 7], nearWall: [74, 68, 70] }
}

// The walls' colours, for LookDefs' gradients.
export function wallColors(tone: Tone): { far: string; near: string } {
    const { farWall, nearWall } = NOTCH_WALLS[tone]
    return { far: css(farWall), near: css(nearWall) }
}

// The top's colour, and its floor's in a groove.
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
