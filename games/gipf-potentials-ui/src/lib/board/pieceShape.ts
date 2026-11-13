import { PieceKind, POTENTIAL_KINDS, type PotentialKind } from '@tabletop/gipf-potentials'
import type { BoardView } from './geometry.js'
import type { Point } from '@tabletop/common'
import { hull } from './hull.js'

// The game shows these pre-rendered: rerun scripts/render-looks.mjs after changing anything here.

export type Tone = 'light' | 'dark'

export type Disc = { tone: Tone; kind: DiscKind; turn?: number }

export type DiscKind = PieceKind.Basic | PotentialKind
export const DISC_KINDS: readonly DiscKind[] = [PieceKind.Basic, ...POTENTIAL_KINDS]

export const TONES: readonly Tone[] = ['light', 'dark']

const TURN_STEP = 30
const TURNS: Record<DiscKind, number> = {
    [PieceKind.Basic]: 1,
    [PieceKind.Tamsk]: 1,
    [PieceKind.Zertz]: 4,
    [PieceKind.Dvonn]: 1,
    [PieceKind.Yinsh]: 12,
    [PieceKind.Punct]: 2
}

// From its id, so a disc lies the same way wherever it goes and whoever looks.
export function turnOf(kind: DiscKind, id: number | undefined, farSide = false): number {
    const half = farSide ? 180 / TURN_STEP : 0
    if (id === undefined) return half % TURNS[kind]
    let hash = Math.imul(id ^ (id >>> 16), 0x85ebca6b)
    hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35)
    hash ^= hash >>> 16
    return ((hash >>> 0) + half) % TURNS[kind]
}

export const DISC_LOOKS: readonly Disc[] = TONES.flatMap((tone) =>
    DISC_KINDS.flatMap((kind) =>
        Array.from({ length: TURNS[kind] }, (_, turn) => ({ tone, kind, turn }))
    )
)

export function lookName(disc: Disc): string {
    return `${disc.tone}-${disc.kind}-${disc.turn ?? 0}`
}

export function discLookId(prefix: string, disc: Disc): string {
    return `${prefix}-disc-${lookName(disc)}`
}

export function lookBox(
    view: BoardView,
    radius: number
): { x: number; y: number; width: number; height: number } {
    const margin = radius * 0.04
    const top = view.height(THICKNESS * radius) + radius * view.tilt + margin
    const bottom = radius * view.tilt + margin
    return { x: -radius - margin, y: -top, width: 2 * (radius + margin), height: top + bottom }
}

export const THICKNESS = 0.2826
const BASE_ROUND = THICKNESS * 0.25
const RIM_ROUND = THICKNESS * 0.3
const STACK_GAP = THICKNESS * 0.24
const TROUGH = { outer: 0.84, inner: 0.62 }
const TROUGH_DEPTH = THICKNESS * 0.4
const GROOVE_WALL = 0.42
// Fine enough that no step shows once the look is scaled down.
const SLICES = 48
const TOP_RADIUS = 1 - RIM_ROUND * 0.6
// The seams between this many bands blend away as the drawn look is scaled down.
const GROOVE_BANDS = 60

// TAMSK's inner groove, measured on the box art.
const TAMSK = { outer: 0.4, inner: 0.18 }
const ZERTZ_ANGLES = [80, 200, 320]
const ZERTZ_RADIUS = 0.11
const ZERTZ_FILLET = 0.04
const ZERTZ_LIP = 0.04
const ZERTZ_FROM = TROUGH.outer - (TROUGH.outer - TROUGH.inner) * 0.6
const ZERTZ_ACROSS = 32
const ZERTZ_ALONG = 24
const ZERTZ_MOUTH_ROWS = 4
const CARVE_MIN = 0.006
const CARVE_FADE = 0.012
// Seen this steeply, a surface sloping away from you more steeply than this faces away.
const FACING_AWAY_SLOPE = -1.1
const DVONN = { lip: 0.385, hole: 0.36, drop: THICKNESS * 0.1 }
const YINSH_HALF_WIDTH = (TROUGH.outer - TROUGH.inner) / 2
const YINSH_OFFSET = 0.04
const YINSH_END = 0.38
const YINSH_ROUND = 0.05
const YINSH_ROUND_IN = 0.01
const YINSH_ALONG = 240
const YINSH_ACROSS = 104
// Where the channel slants, the groove's inner wall it uncovers shows.
const YINSH_MOUTH_SPILL = 0.1
const YINSH_TURNS = 48
const PUNCT_NOTCHES = 6
const PUNCT_RADIUS = 0.15

function punctCentres(turn: number): number[] {
    return Array.from(
        { length: PUNCT_NOTCHES },
        (_, index) => (((360 / PUNCT_NOTCHES) * (index + 0.5) + TURN_STEP * turn) * Math.PI) / 180
    )
}
const PUNCT_WALL_STRIPS = 48

export const SHADE_LEVELS = 33

export type Slice = { y: number; rx: number; ry: number; level: number }
export type Ellipse = { y: number; rx: number; ry: number }

export type Band = { outer: Ellipse; near: string; color: string; steep: number }

export type Strip = { d: string; fill: string; opacity: number }

export type SideBand = { d: string; level: number }

export type CutPart = SideBand | Strip

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
          cover?: { top: string; opening: string; fill: string }
      }
    | { kind: 'cuts'; parts: CutPart[]; topCuts: string[]; outline: string }

export type PieceDrawing = {
    slices: Slice[]
    bases: number[]
}

const SIDE_HEIGHTS = Array.from({ length: SLICES + 1 }, (_, step) => (THICKNESS * step) / SLICES)

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

function discBases(discs: number): number[] {
    return Array.from({ length: discs }, (_, index) => STACK_GAP + index * (THICKNESS + STACK_GAP))
}

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

export function creaseOf(view: BoardView, disc: Disc, radius: number): string {
    const flat = onFlat(view, radius)
    const notches = disc.kind === PieceKind.Punct ? punctCentres(disc.turn ?? 0) : []
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

function onFlat(view: BoardView, radius: number) {
    return (u: number, v: number, height = THICKNESS): Point => ({
        x: u * radius,
        y: -v * radius * view.tilt - view.height(height * radius)
    })
}

// Strips end where the side's circle crosses the notch's, as the side's bands do, so no gap shows.
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
    const point = (t: number): [number, number] => [1 - Math.sin(t) * r, Math.cos(t) * r]
    const lipAt = (height: number) => {
        const side = profile(height).radius
        return Math.asin(Math.min(1, (1 + r * r - side * side) / (2 * r)))
    }
    // A little past the top, under its cut edge, so no seam shows there.
    const lip = THICKNESS * 0.03
    const heights = [
        ...SIDE_HEIGHTS.map((height) => ({ height, at: height })),
        {
            height: THICKNESS + lip,
            at: THICKNESS
        }
    ]
    const turnAt = (at: number, across: number) => {
        const from = lipAt(at)
        return from + (Math.PI - 2 * from) * across
    }
    const step = 1 / PUNCT_WALL_STRIPS
    return Array.from({ length: PUNCT_WALL_STRIPS }, (_, index) => index * step).flatMap((from) => {
        const middle = turnAt(THICKNESS / 2, from + step / 2)
        const normal = {
            u: along.u * Math.sin(middle) - across.u * Math.cos(middle),
            v: along.v * Math.sin(middle) - across.v * Math.cos(middle)
        }
        if (normal.v >= 0) return []
        // Each strip overlaps the next, but not past the lips, so no seam shows.
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

// Lit from the left, as the pieces' sides are.
function wallShade(tone: Tone, normal: { u: number; v: number }): string {
    const { floor } = TOP_PALETTE[tone]
    const { farWall, nearWall } = NOTCH_WALLS[tone]
    const base = mix(floor, farWall, 0.5)
    return css(
        normal.u < 0 ? mix(base, nearWall, -normal.u * 0.7) : mix(base, farWall, normal.u * 0.8)
    )
}

// Only cells the carving lowers are drawn, far ones first, so nearer ones cover them.
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
        behind?: string
        colorAt?: (u: number, v: number, carve: number) => string | undefined
        uncut?: (u: number, v: number) => boolean
        // Drawn whole, fading by colorAt: the surface beneath may differ, and overlaps would show.
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
                // Barely cut, a cell fades into its surface, so the carving's edge is soft.
                opacity: opaque ? 1 : Math.min(1, carve / CARVE_FADE),
                depth: v
            })
        }
    }
    return cells
        .toSorted((p, q) => q.depth - p.depth)
        .map(({ d, fill, opacity }) => ({ d, fill, opacity }))
}

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
    const facesYou = along.v < 0.4
    const reach = facesYou ? 1 : TOP_RADIUS
    const at = (out: number, side: number, height: number) =>
        flat(along.u * out + across.u * side, along.v * out + across.v * side, height)
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
    const mouth = (side: number) => (facesYou ? profile(notch(side)).radius : reach)
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
    const footprint = polygon([
        at(rim, width, THICKNESS),
        ...sides.toReversed().map((side) => at(mouth(side), side, notch(side))),
        at(rim, -width, THICKNESS)
    ])
    const beyond = polygon([
        at(1.3, width, THICKNESS),
        ...sides.toReversed().map((side) => at(reach, side, notch(side))),
        at(1.3, -width, THICKNESS)
    ])
    return {
        // Facing you nothing is cut: a cut's soft edge showed as a seam under the backing.
        through: facesYou ? [] : [beyond],
        clip: [footprint, inGroove],
        backing: [footprint],
        cells
    }
}

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

function smoothMin(a: number, b: number, k: number): number {
    const h = Math.max(0, Math.min(1, 0.5 + (0.5 * (b - a)) / k))
    return b + (a - b) * h - k * h * (1 - h)
}

function polygon(points: Point[]): string {
    return `M ${points.map((point) => `${point.x} ${point.y}`).join(' L ')} Z`
}

function grooveDepth(distance: number, { outer, inner }: { outer: number; inner: number }): number {
    if (distance >= outer || distance <= inner) return 0
    const across = (outer - distance) / (outer - inner)
    const fromLip = Math.min(across, 1 - across) / GROOVE_WALL
    return fromLip >= 1 ? TROUGH_DEPTH : (TROUGH_DEPTH * (1 - Math.cos(Math.PI * fromLip))) / 2
}

export function topProfile(kind: PieceKind, distance: number): number {
    const tamsk = kind === PieceKind.Tamsk ? grooveDepth(distance, TAMSK) : 0
    const hole = kind === PieceKind.Dvonn ? lipDrop(distance) : 0
    return THICKNESS - grooveDepth(distance, TROUGH) - tamsk - hole
}

function lipDrop(distance: number): number {
    if (distance >= DVONN.lip) return 0
    const into = Math.min(1, (DVONN.lip - distance) / (DVONN.lip - DVONN.hole))
    return DVONN.drop * (1 - Math.cos((Math.PI * into) / 2))
}

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
        // Each near half reaches under the band outside it, drawn after it, so no seam shows.
        const reach = edges[Math.max(0, index - 1)]
        return {
            outer: ellipse(outerHeight, outer),
            near: nearHalf(ellipse(topProfile(kind, reach), reach), ellipse(innerHeight, inner)),
            color: css(base),
            steep
        }
    })
}

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

// Angles run anticlockwise as you look, 0 to the right; `off` is a cut's offset left of centre.
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
const GAP_MARGIN = 0.05

// PÜNCT's side is built from bands between the notches, not cut, so notch edges are exact.
function punctNotches(view: BoardView, radius: number, tone: Tone, turn: number): Mark {
    const flat = onFlat(view, radius)
    const r = PUNCT_RADIUS
    const centres = punctCentres(turn)
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
    type Placed = { part: CutPart; away: number }
    // Each band reaches a little up into the next, drawn after it, so no seam shows.
    const bands = (heights: readonly number[], within: [number, number]): Placed[] =>
        heights.slice(0, -1).flatMap((height, index) => {
            const top = Math.min(THICKNESS, heights[index + 1] + THICKNESS * 0.01)
            const middle = (height + heights[index + 1]) / 2
            // The angles given may run past a full turn.
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

// The groove's floor in the channel's mouth shows through when the board is turned.
function yinshChannel(view: BoardView, radius: number, tone: Tone, turn: number): Mark {
    const flat = onFlat(view, radius)
    const angle = (TURN_STEP * turn * Math.PI) / 180
    const [cos, sin] = [Math.cos(angle), Math.sin(angle)]
    const turned = ({ u, v }: { u: number; v: number }) => ({
        u: u * cos - v * sin,
        v: u * sin + v * cos
    })
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
    // Rounded only where both cut, and gently in from their lips, so the top stays flat round them.
    const cuts = (u: number, v: number) => {
        const ringDepth = THICKNESS - ring(u, v)
        const channelDepth = grooveDepth(lineDistance(u, v), across)
        const round = YINSH_ROUND * Math.min(1, Math.min(ringDepth, channelDepth) / YINSH_ROUND_IN)
        return { ringDepth, channelDepth, round }
    }
    // Never below their floor, which the rounding would dimple where the two floors meet.
    const height = (u: number, v: number) => {
        const { ringDepth, channelDepth, round } = cuts(u, v)
        return round > 0
            ? Math.max(
                  THICKNESS - TROUGH_DEPTH,
                  THICKNESS + smoothMin(-ringDepth, -channelDepth, round)
              )
            : THICKNESS - Math.max(ringDepth, channelDepth)
    }
    // Cut from the top in its mouth, the bands are drawn whole, not faded, or they covered the lip.
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
    // Trimmed to a smooth line at each side, so the cells' stepped edges don't show.
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
    // Closed across the mouth itself, the outline would trim the cells that open into the groove.
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

// Undefined where it faces away, out of sight.
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

function farWall({ y, rx, ry }: Ellipse, depth: number): string {
    const x = rx * Math.sqrt(Math.max(0, 1 - (depth / (2 * ry)) ** 2))
    const mid = y + depth / 2
    return `M ${-x} ${mid} A ${rx} ${ry} 0 1 1 ${x} ${mid} A ${rx} ${ry} 0 0 0 ${-x} ${mid} Z`
}

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

const NOTCH_WALLS: Record<Tone, { farWall: Rgb; nearWall: Rgb }> = {
    light: { farWall: [172, 162, 128], nearWall: [226, 219, 194] },
    dark: { farWall: [8, 7, 7], nearWall: [74, 68, 70] }
}

export function wallColors(tone: Tone): { far: string; near: string } {
    const { farWall, nearWall } = NOTCH_WALLS[tone]
    return { far: css(farWall), near: css(nearWall) }
}

const TOP_PALETTE: Record<Tone, { flat: Rgb; floor: Rgb }> = {
    light: { flat: [236, 230, 208], floor: [207, 198, 166] },
    dark: { flat: [44, 40, 41], floor: [16, 14, 15] }
}

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
