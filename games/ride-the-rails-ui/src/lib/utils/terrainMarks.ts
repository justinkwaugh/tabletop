import { assert, type Point } from '@tabletop/common'
import { hexIdToAxial, type HexId, type ImpassablePair } from '@tabletop/ride-the-rails'
import { hexCells, hexCenter, hexFrameOf, insetLoop, type BoardGeometry } from './boardGeometry.js'

// Art plan, Expansion boards: the marks the expansion maps' boards add inside their hexes, in board
// units from a hex's centre, each drawn as plain shapes (no filter, mask or pattern).

/**
 * A limit inside a hex: an inked outline of a cube with the most locomotives the hex holds, on a
 * pale ground, so it reads on any fill.
 */
export const HEX_LIMIT_MARK = {
    side: 15,
    radius: 2.2,
    strokeWidth: 1.6,
    fontSize: 11.5,
    /** The number's baseline below the mark's centre. */
    baseline: 4.1,
    groundOpacity: 0.75
} as const

/** Where an in-hex limit mark stands: the top centre of a plain hex, the top left of a city's. */
export const HEX_LIMIT_MARK_AT = {
    plain: { x: 0, y: -22 },
    city: { x: -14.4, y: -21 }
} as const

export type HexLimitMarkView = { hexId: HexId; text: string; x: number; y: number }

/**
 * R-8: every hex other than a city that holds one locomotive, a long-distance hex (Australia) or a
 * Paris entry hex (France), carries a 1 at its top centre.
 */
export function hexLimitMarks(geometry: BoardGeometry): HexLimitMarkView[] {
    return geometry.map.hexes.flatMap((hex) => {
        if (hex.terrain === 'city' || geometry.map.capacity(hex.id) !== 1) return []
        const center = geometry.place(hex.id).center
        return [
            {
                hexId: hex.id,
                text: '1',
                x: center.x + HEX_LIMIT_MARK_AT.plain.x,
                y: center.y + HEX_LIMIT_MARK_AT.plain.y
            }
        ]
    })
}

/**
 * R-8.2: the Alps' hatch over their mountain fill, the sea's 45° lines (7 apart, on the sea's own
 * lattice) a little heavier, in the peak's brown.
 */
export const ALPS_HATCH = { spacing: 7, width: 2.2 } as const

function pointText({ x, y }: Point): string {
    return `${x.toFixed(1)} ${y.toFixed(1)}`
}

/**
 * Where the line x + y = `offset` crosses a convex cell: the two points it enters and leaves by,
 * or none where it only touches a corner or misses.
 */
function crossing(corners: readonly Point[], offset: number): [Point, Point] | undefined {
    const points: Point[] = []
    corners.forEach((from, index) => {
        const to = corners[(index + 1) % corners.length]
        if (!to) return
        const a = from.x + from.y - offset
        const b = to.x + to.y - offset
        if (a === b || a * b > 0 || (b === 0 && a !== 0)) return
        const t = a / (a - b)
        points.push({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t })
    })
    if (points.length < 2) return undefined
    const sorted = points.toSorted((p, q) => q.x - p.x)
    const first = sorted[0]
    const last = sorted.at(-1)
    if (!first || !last || Math.hypot(first.x - last.x, first.y - last.y) < 0.5) return undefined
    return [first, last]
}

/**
 * The Alps' hatch as one path of drawn lines, each cut to the Alps cell it crosses, running down
 * to the left as the sea's do: no pattern and no clip, so it costs what the sea's hatch costs.
 */
export function alpsHatchPath(geometry: BoardGeometry): string {
    const step = ALPS_HATCH.spacing * Math.SQRT2
    const segments: string[] = []
    for (const hex of geometry.map.hexes) {
        if (hex.terrain !== 'alps') continue
        for (const cell of geometry.place(hex.id).cells) {
            const sums = cell.vertices.map((corner) => corner.x + corner.y)
            const first = Math.ceil(Math.min(...sums) / step)
            const last = Math.floor(Math.max(...sums) / step)
            for (let line = first; line <= last; line++) {
                const ends = crossing(cell.vertices, line * step)
                if (ends) segments.push(`M${pointText(ends[0])}L${pointText(ends[1])}`)
            }
        }
    }
    return segments.join('')
}

/**
 * R-8.2: a long-distance hex's hourglass, the turn ending there, at the bottom of the hex below
 * its 1: an inked frame round a pale glass, sand in its lower bulb. In its own units round its
 * middle, `half` its reach each way.
 */
export const HOURGLASS = {
    at: { x: 0, y: 24 },
    half: { x: 5.9, y: 7.9 },
    frame: 'M-5 -7H5M-5 7H5',
    frameWidth: 1.8,
    glass: 'M-3.8 -6.2H3.8L0.9 0L3.8 6.2H-3.8L-0.9 0Z',
    glassWidth: 1.3,
    glassOpacity: 0.8,
    sand: 'M-2.2 5.2H2.2L0 2.6Z'
} as const

/**
 * R-8.3, R-8.4: an impassable side (a river, an estuary, a lake shore) as a water channel along
 * the side: the sea's colour on a deeper edge, so it reads on cream and on the sea alike.
 */
export const IMPASSABLE_CHANNEL = { edgeWidth: 9, waterWidth: 4.6 } as const

export type ImpassableSide = { pair: ImpassablePair; from: Point; to: Point }

const SAME_CORNER = 0.5

/**
 * R-8: every printed impassable side of the map, in its table's order: the side the two hexes'
 * cells share, the second of them a cell off the board where the side runs along the shore.
 */
export function impassableSides(geometry: BoardGeometry): ImpassableSide[] {
    const corners = (hexId: HexId) =>
        geometry.map.hasHex(hexId)
            ? geometry.place(hexId).cells.flatMap((cell) => cell.vertices)
            : geometry.cellAt(hexIdToAxial(geometry.orientation, hexId)).vertices
    return geometry.map.impassable.map((pair) => {
        const [a, b] = pair
        const others = corners(b)
        const shared = corners(a).filter((corner) =>
            others.some((other) => Math.hypot(other.x - corner.x, other.y - corner.y) < SAME_CORNER)
        )
        const [from, to] = shared
        assert(shared.length === 2 && from && to, `${a} and ${b} share no side`)
        return { pair, from, to }
    })
}

/** R-8.4: the ring of entry hexes round Paris: its outside edged in navy. */
export const ENTRY_RING = { width: 2.4 } as const

export type EntryRingSide = { hexId: HexId; from: Point; to: Point }

/**
 * R-8.4: the sides of the Paris entry hexes that face neither another entry hex nor the city with
 * no limit they ring, so the six read as one group round Paris.
 */
export function entryRingSides(geometry: BoardGeometry): EntryRingSide[] {
    const { map } = geometry
    const key = ({ x, y }: Point) => `${Math.round(x)},${Math.round(y)}`
    const hexAt = new Map(
        geometry.hexIds.flatMap((hexId) =>
            geometry.place(hexId).cells.map((cell): [string, HexId] => [key(cell.center), hexId])
        )
    )
    const inner = (hexId: HexId | undefined) =>
        hexId !== undefined &&
        (map.groupsOf(hexId).includes('paris-entry') || map.capacity(hexId) === 'unlimited')
    return map.hexes.flatMap((hex) => {
        if (!map.groupsOf(hex.id).includes('paris-entry')) return []
        return geometry.place(hex.id).cells.flatMap((cell) =>
            cell.vertices.flatMap((from, index): EntryRingSide[] => {
                const to = cell.vertices[(index + 1) % cell.vertices.length]
                if (!to) return []
                const across = {
                    x: from.x + to.x - cell.center.x,
                    y: from.y + to.y - cell.center.y
                }
                return inner(hexAt.get(key(across))) ? [] : [{ hexId: hex.id, from, to }]
            })
        )
    })
}

// R-8.5: Berlin, one city over two cells: one band round its whole outline, as a single cell's.

/** Degrees clockwise from the top, as a band's spans count them. */
function bearingOfPoint({ x, y }: Point): number {
    return ((Math.atan2(x, -y) * 180) / Math.PI + 360) % 360
}

/** Where a ray from the origin at this bearing leaves a loop the origin sees whole. */
function rayExit(loop: readonly Point[], degrees: number): Point {
    const radians = (degrees * Math.PI) / 180
    const direction = { x: Math.sin(radians), y: -Math.cos(radians) }
    let nearest: Point | undefined
    let nearestReach = Infinity
    loop.forEach((from, index) => {
        const to = loop[(index + 1) % loop.length] ?? from
        const side = { x: to.x - from.x, y: to.y - from.y }
        const cross = direction.x * side.y - direction.y * side.x
        if (Math.abs(cross) < 1e-9) return
        const reach = (from.x * side.y - from.y * side.x) / cross
        const along = (from.x * direction.y - from.y * direction.x) / cross
        if (reach > 0 && along >= -1e-9 && along <= 1 + 1e-9 && reach < nearestReach) {
            nearestReach = reach
            nearest = { x: direction.x * reach, y: direction.y * reach }
        }
    })
    assert(nearest !== undefined, `No side at ${degrees}°`)
    return nearest
}

/** The loop's corners between two bearings, with where the two rays leave it at each end. */
function loopRun(loop: readonly Point[], from: number, to: number): Point[] {
    const between = loop
        .map((corner) => ({ corner, bearing: bearingOfPoint(corner) }))
        .filter(({ bearing }) => bearing > from + 1e-6 && bearing < to - 1e-6)
        .toSorted((a, b) => a.bearing - b.bearing)
        .map(({ corner }) => corner)
    return [rayExit(loop, from), ...between, rayExit(loop, to)]
}

function bandPath(points: readonly Point[]): string {
    return `M${points.map(pointText).join('L')}Z`
}

/**
 * A start band round an outline of several cells, its points from the hex's centre: one closed
 * path per span between the outline and the outline a band's width in, a single span the whole
 * ring (filled even-odd), as `startBandPaths` draws a single cell's.
 */
export function outlineBandPaths(
    outline: readonly Point[],
    spans: readonly { from: number; to: number }[],
    width: number
): string[] {
    const inner = insetLoop(outline, width)
    if (spans.length === 1) return [`${bandPath(outline)}${bandPath(inner)}`]
    return spans.map(({ from, to }) =>
        bandPath([...loopRun(outline, from, to), ...loopRun(inner, from, to).reverse()])
    )
}

/** A separator across an outline's band where each span starts, when there are two or more. */
export function outlineBandSeparators(
    outline: readonly Point[],
    spans: readonly { from: number; to: number }[],
    width: number
): string[] {
    if (spans.length < 2) return []
    const inner = insetLoop(outline, width)
    return spans.map(({ from }) => {
        const outer = rayExit(outline, from)
        const end = rayExit(inner, from)
        return `M${pointText(outer)}L${pointText(end)}`
    })
}

/**
 * Where a city's bonus pill stands: at the bottom centre of its hex, of its second cell for a city
 * over two (R-8: Berlin's passenger and limit mark take its first).
 */
export function bonusPillSpot(hexId: HexId): Point {
    const cell = hexCells(hexId).at(-1)
    const center = cell?.center ?? hexCenter(hexId)
    const offset = hexFrameOf(hexId).bonusPill
    return { x: center.x + offset.x, y: center.y + offset.y }
}
