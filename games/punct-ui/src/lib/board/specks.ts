import type { Point } from '@tabletop/common'
import { PieceKind } from '@tabletop/punct'
import { PIECE_HALF_WIDTH, PIECE_THICKNESS, type BoardView } from './geometry.js'
import { DISH, dishDepth, dishPointSeen } from './dishShape.js'
import {
    dotPlan,
    insetAt,
    outlinePlan,
    pointInPolygon,
    spineSegments,
    TOP_INSET
} from './pieceShape.js'

// The flecks in a piece's plastic, seeded by the piece's id so they stay its own as it moves
// and turns: on its top and down into its minor dots' dishes, round its PÜNCT's smooth insert,
// and on its side. As in the real pieces, many small flecks, most dark on white and light on
// black, some grey, spread evenly over the piece.

// How many flecks to a hundred square units of surface, how large they are against the usual,
// and what share of them are grey: chosen from a range of densities and sizes.
const FLECKS = { density: 2.5, size: 1.3, grey: 0.35 }

// Positions on the piece's plan (unturned, its PÜNCT at the origin) or, on its side, along its
// outline and up it; sizes in board units.
type Speck = { x: number; y: number; r: number; stretch: number; turn: number; grey: boolean }
// A fleck on the side: where it lies on the full outline, along which way, and how far up it.
type SideSpeck = Speck & { tx: number; ty: number; height: number }
export type Specks = { top: Speck[]; side: SideSpeck[] }

function random(seed: number): () => number {
    let state = seed >>> 0
    return () => {
        state = (state + 0x6d2b79f5) >>> 0
        let t = state
        t = Math.imul(t ^ (t >>> 15), t | 1)
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}

type Shape = { r: number; stretch: number; turn: number; grey: boolean }

function shape(next: () => number): Shape {
    return {
        r: (0.35 + 0.75 * next() ** 2) * FLECKS.size,
        stretch: 1 + next() * 1.1,
        turn: next() * Math.PI,
        grey: next() < FLECKS.grey
    }
}

// Math.hypot, without its care for huge values: several times faster in the loops below.
function distanceOf(x: number, y: number): number {
    return Math.sqrt(x * x + y * y)
}

// How many places each fleck tries before it settles in the one with the most room round it
// (best-candidate sampling): flecks spread evenly, with no bare patches and no clumps, yet in no
// pattern. Only flecks within NEAR units of a place are looked at, kept in a grid of cells that
// size.
const TRIES = 10
const NEAR = 4

// Each fleck is spread by a place on a flat plane (x, y), and carries what drawing it needs.
type Placed<E> = Shape & { x: number; y: number; extra: E }

function spread<E>(
    count: number,
    next: () => number,
    // The part of the plane places fall in.
    bounds: { x: number; y: number; width: number; height: number },
    // A place for a fleck of this shape, or nothing if the try missed the surface.
    place: (shape: Shape) => { x: number; y: number; extra: E } | undefined
): Placed<E>[] {
    const placed: Placed<E>[] = []
    // Each cell's flecks as their x, y and reach in turn, a cell's margin round the bounds.
    const columns = Math.ceil(bounds.width / NEAR) + 3
    const rows = Math.ceil(bounds.height / NEAR) + 3
    const cells: number[][] = Array.from({ length: columns * rows }, () => [])
    const columnOf = (x: number) => Math.floor((x - bounds.x) / NEAR) + 1
    const rowOf = (y: number) => Math.floor((y - bounds.y) / NEAR) + 1
    for (let index = 0; index < count; index++) {
        const speck = shape(next)
        const extent = speck.r * speck.stretch
        let best: { x: number; y: number; extra: E } | undefined
        let bestRoom = -Infinity
        for (let attempt = 0; attempt < TRIES; attempt++) {
            const candidate = place(speck)
            if (candidate === undefined) continue
            // Beyond the cells round it, a fleck is at least NEAR away.
            let room = NEAR - extent
            const column = columnOf(candidate.x)
            const row = rowOf(candidate.y)
            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    const cell = cells[(column + dx) * rows + row + dy]
                    if (cell === undefined) continue
                    for (let at = 0; at < cell.length; at += 3) {
                        const gap =
                            distanceOf(candidate.x - cell[at], candidate.y - cell[at + 1]) -
                            extent -
                            cell[at + 2]
                        if (gap < room) room = gap
                    }
                }
            }
            if (room > bestRoom) {
                bestRoom = room
                best = candidate
            }
        }
        if (best === undefined) continue
        placed.push({ ...speck, ...best })
        cells[columnOf(best.x) * rows + rowOf(best.y)]?.push(best.x, best.y, extent)
    }
    return placed
}

// How far a point lies inside the edge of a top this far out from the bars it is built along:
// outside a closed piece's bars, as far as the width reaches past the nearest; inside, further.
function roomInside(
    point: Point,
    bars: readonly [Point, Point][],
    closed: Point[] | undefined,
    width: number
): number {
    let nearest = Infinity
    for (const [a, b] of bars) {
        const dx = b.x - a.x
        const dy = b.y - a.y
        const length = dx * dx + dy * dy
        const t =
            length === 0
                ? 0
                : Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / length))
        const distance = distanceOf(point.x - a.x - dx * t, point.y - a.y - dy * t)
        if (distance < nearest) nearest = distance
    }
    return closed && pointInPolygon(point, closed) ? width + nearest : width - nearest
}

function areaOf(points: readonly Point[]): number {
    let area = 0
    for (let index = 0; index < points.length; index++) {
        const a = points[index]
        const b = points[(index + 1) % points.length]
        area += a.x * b.y - b.x * a.y
    }
    return Math.abs(area / 2)
}

const cache = new Map<string, Specks>()

// Laid out on the piece unturned; drawn turned with it.
export function specksOf(kind: PieceKind, seed: number): Specks {
    const key = `${kind}:${seed}`
    const cached = cache.get(key)
    if (cached) return cached
    const next = random(seed * 7919 + kind.length * 104729)
    // On the top, clear of its edge and of the PÜNCT's smooth insert.
    const width = PIECE_HALF_WIDTH - TOP_INSET
    const top = outlinePlan(kind, 0, width)
    const bars = spineSegments(kind, 0)
    const closed = kind === PieceKind.Triangle ? bars.map(([a]) => a) : undefined
    const punct = dotPlan(kind, 0)[0]
    const xs = top.map((point) => point.x)
    const ys = top.map((point) => point.y)
    const box = { x: Math.min(...xs), y: Math.min(...ys) }
    const size = { width: Math.max(...xs) - box.x, height: Math.max(...ys) - box.y }
    const topSpecks: Speck[] = spread(
        Math.round((areaOf(top) * FLECKS.density) / 100),
        next,
        { ...box, ...size },
        (speck) => {
            const point = { x: box.x + next() * size.width, y: box.y + next() * size.height }
            const extent = speck.r * speck.stretch
            if (roomInside(point, bars, closed, width) < extent + 0.5) return undefined
            if (distanceOf(point.x - punct.x, point.y - punct.y) < DISH.top + extent + 0.3)
                return undefined
            return { x: point.x, y: point.y, extra: undefined }
        }
    ).map(({ extra: _, ...speck }) => speck)
    // On the side, along the outline and up it, short of the rounded rim and foot: spread by how
    // far along the outline and how high up.
    const full = outlinePlan(kind, 0)
    const edges = full.map((a, index) => {
        const b = full[(index + 1) % full.length]
        const length = Math.hypot(b.x - a.x, b.y - a.y)
        return { a, b, length }
    })
    const perimeter = edges.reduce((sum, edge) => sum + edge.length, 0)
    const sideSpecks: SideSpeck[] = spread(
        Math.round((perimeter * PIECE_THICKNESS * FLECKS.density) / 100),
        next,
        { x: 0, y: 0, width: perimeter, height: PIECE_THICKNESS },
        () => {
            const distance = next() * perimeter
            const height = PIECE_THICKNESS * (0.2 + next() * 0.6)
            let along = distance
            let index = 0
            while (index < edges.length - 1 && along > edges[index].length) {
                along -= edges[index++].length
            }
            const { a, b, length } = edges[index]
            if (length < 1e-9) return undefined
            const t = along / length
            return {
                x: distance,
                y: height,
                extra: {
                    at: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t },
                    tx: (b.x - a.x) / length,
                    ty: (b.y - a.y) / length,
                    height
                }
            }
        }
    ).map(({ extra: { at, ...extra }, x: _x, y: _y, ...speck }) => ({ ...speck, ...extra, ...at }))
    const specks = { top: topSpecks, side: sideSpecks }
    cache.set(key, specks)
    return specks
}

function turn(point: Point, angle: number): Point {
    const radians = (angle * Math.PI) / 3
    const cos = Math.cos(radians)
    const sin = Math.sin(radians)
    return { x: point.x * cos - point.y * sin, y: point.x * sin + point.y * cos }
}

// Fleck paths are written in twentieths of a unit, as whole numbers, and drawn scaled down by
// SPECK_SCALE: whole numbers are quicker to write and to read back than fractions, and shorter.
const TWENTIETHS = 20
export const SPECK_SCALE = 1 / TWENTIETHS

// Points round a fleck, as the cosine and sine of each one's angle.
const AROUND = Array.from({ length: 8 }, (_, index) => {
    const t = (index / 8) * Math.PI * 2
    return [Math.cos(t), Math.sin(t)]
})

// A fleck as a polygon round its centre on screen, from its two half axes on screen.
function polygon(center: Point, u: Point, v: Point): string {
    let d = ''
    for (let index = 0; index < AROUND.length; index++) {
        const [c, s] = AROUND[index]
        const x = Math.round((center.x + u.x * c + v.x * s) * TWENTIETHS)
        const y = Math.round((center.y + u.y * c + v.y * s) * TWENTIETHS)
        d += (index ? 'L' : 'M') + x + ' ' + y
    }
    return d + 'Z'
}

export type SpeckPaths = { top: string; topGrey: string; side: string; sideGrey: string }

// One path for each shade of the flecks on the top face, and on the side where it faces the
// viewer, each drawn in from the full width as far as the rounding there takes it.
function speckPathsOf(kind: PieceKind, seed: number, angle: number, view: BoardView): SpeckPaths {
    const specks = specksOf(kind, seed)
    const dishes = dotPlan(kind, angle).slice(1)
    const paths: SpeckPaths = { top: '', topGrey: '', side: '', sideGrey: '' }
    for (const speck of specks.top) {
        const point = turn(speck, angle)
        // Down in a dish, a fleck lies on its surface, unless the lip hides it.
        const dish = dishes.find((dot) => Math.hypot(point.x - dot.x, point.y - dot.y) < DISH.top)
        let depth = 0
        if (dish) {
            const offset = { x: point.x - dish.x, y: point.y - dish.y }
            if (!dishPointSeen(offset.x, offset.y, view)) continue
            depth = dishDepth(Math.hypot(offset.x, offset.y))
        }
        const along = speck.turn + (angle * Math.PI) / 3
        const long = speck.r * speck.stretch
        const d = polygon(
            view.project(point, PIECE_THICKNESS - depth),
            { x: Math.cos(along) * long, y: Math.sin(along) * long * view.tilt },
            { x: -Math.sin(along) * speck.r, y: Math.cos(along) * speck.r * view.tilt }
        )
        if (speck.grey) paths.topGrey += d
        else paths.top += d
    }
    for (const speck of specks.side) {
        // Only where the side faces the viewer: clockwise on screen, the outward normal of the
        // outline's way along points to its left.
        const tangent = turn({ x: speck.tx, y: speck.ty }, angle)
        const normal = { x: tangent.y, y: -tangent.x }
        if (normal.y <= 0.05) continue
        const inset = insetAt(speck.height)
        const at = turn(speck, angle)
        const point = { x: at.x - normal.x * inset, y: at.y - normal.y * inset }
        const long = speck.r * Math.min(speck.stretch, 1.4)
        const up = Math.min(speck.r, PIECE_THICKNESS * 0.15)
        const d = polygon(
            view.project(point, speck.height),
            { x: tangent.x * long, y: tangent.y * long * view.tilt },
            { x: 0, y: -up * view.rise }
        )
        if (speck.grey) paths.sideGrey += d
        else paths.side += d
    }
    return paths
}

// Worked out once for each piece and way it lies, as drawings are (pieceShape.ts).
const PATHS_LIMIT = 400
const paths = new Map<string, SpeckPaths>()

export function speckPaths(
    kind: PieceKind,
    seed: number,
    angle: number,
    view: BoardView
): SpeckPaths {
    const key = `${kind}|${seed}|${angle}|${view.tilt}`
    let found = paths.get(key)
    if (found === undefined) {
        if (paths.size >= PATHS_LIMIT) paths.clear()
        found = speckPathsOf(kind, seed, angle, view)
        paths.set(key, found)
    }
    return found
}
