import type { Point } from '@tabletop/common'

export type TileDrawnPath = {
    id: string
    start: Point
    end: Point
    controls: readonly [Point, Point]
    arc?: { center: Point; radius: number; sweep: number }
    d: string
    spike?: TrackSpike
}
export type TrackSpike = { base: Point; tip: Point }

export function spikePoints({ base, tip }: TrackSpike, width: number): string {
    const length = Math.hypot(tip.x - base.x, tip.y - base.y)
    const nx = ((base.y - tip.y) / length) * (width / 2)
    const ny = ((tip.x - base.x) / length) * (width / 2)
    return [
        [base.x + nx, base.y + ny],
        [tip.x, tip.y],
        [base.x - nx, base.y - ny]
    ]
        .map(([x, y]) => `${x},${y}`)
        .join(' ')
}

export function createStraightTilePath(id: string, start: Point, end: Point): TileDrawnPath {
    return {
        id,
        start,
        end,
        controls: [start, end],
        d: `M ${start.x} ${start.y} L ${end.x} ${end.y}`
    }
}

export function createCubicTilePath(
    id: string,
    start: Point,
    end: Point,
    controls: readonly [Point, Point]
): TileDrawnPath {
    return {
        id,
        start,
        end,
        controls,
        d: `M ${start.x} ${start.y} C ${controls[0].x} ${controls[0].y} ${controls[1].x} ${controls[1].y} ${end.x} ${end.y}`
    }
}

export function createEdgeTilePath(id: string, start: Point, end: Point): TileDrawnPath {
    const determinant = start.x * end.y - start.y * end.x
    if (Math.abs(determinant) < 0.001) return createStraightTilePath(id, start, end)
    const startSquared = start.x ** 2 + start.y ** 2
    const endSquared = end.x ** 2 + end.y ** 2
    const center = {
        x: (startSquared * end.y - endSquared * start.y) / determinant,
        y: (start.x * endSquared - end.x * startSquared) / determinant
    }
    return createArcTilePath(id, start, end, center)
}

export function createArcTilePath(
    id: string,
    start: Point,
    end: Point,
    center: Point
): TileDrawnPath {
    const a = { x: start.x - center.x, y: start.y - center.y }
    const b = { x: end.x - center.x, y: end.y - center.y }
    const radius = Math.hypot(a.x, a.y)
    const sweep = Math.atan2(a.x * b.y - a.y * b.x, a.x * b.x + a.y * b.y)
    const handle = (4 / 3) * Math.tan(sweep / 4)
    return {
        id,
        start,
        end,
        controls: [
            { x: start.x - a.y * handle, y: start.y + a.x * handle },
            { x: end.x + b.y * handle, y: end.y - b.x * handle }
        ],
        arc: { center, radius, sweep },
        d: `M ${start.x} ${start.y} A ${radius} ${radius} 0 0 ${sweep > 0 ? 1 : 0} ${end.x} ${end.y}`
    }
}

export function tilePathPoint(path: TileDrawnPath, t: number): Point {
    if (path.arc) {
        const { center, radius, sweep } = path.arc
        const angle = Math.atan2(path.start.y - center.y, path.start.x - center.x) + sweep * t
        return { x: center.x + radius * Math.cos(angle), y: center.y + radius * Math.sin(angle) }
    }
    const weights = [(1 - t) ** 3, 3 * (1 - t) ** 2 * t, 3 * (1 - t) * t ** 2, t ** 3]
    return [path.start, ...path.controls, path.end].reduce(
        (point, control, i) => ({
            x: point.x + control.x * weights[i],
            y: point.y + control.y * weights[i]
        }),
        { x: 0, y: 0 }
    )
}

/**
 * Where two of a tile's tracks cross without connecting, with the later path drawn over the
 * earlier. ``spread`` widens the crossing for a shallow angle, where the over track runs
 * longer across the under track.
 */
export type TrackCrossing = { point: Point; overPathId: string; spread: number }
const CrossingSamples = 32
const CrossingEndClearance = 4

export function trackCrossings(paths: readonly TileDrawnPath[]): TrackCrossing[] {
    const tracks = paths
        .filter((path) => !path.spike)
        .map((path) => ({
            path,
            points: Array.from({ length: CrossingSamples + 1 }, (_, index) =>
                tilePathPoint(path, index / CrossingSamples)
            )
        }))
    const crossings: TrackCrossing[] = []
    tracks.forEach((under, index) => {
        for (const over of tracks.slice(index + 1)) {
            if (sharesEnd(under.path, over.path)) continue
            for (const crossing of polylineCrossings(under.points, over.points)) {
                const ends = [under.path.start, under.path.end, over.path.start, over.path.end]
                if (ends.some((end) => distance(end, crossing.point) < CrossingEndClearance))
                    continue
                if (crossings.some((known) => distance(known.point, crossing.point) < 3)) continue
                crossings.push({ ...crossing, overPathId: over.path.id })
            }
        }
    })
    return crossings
}

function sharesEnd(first: TileDrawnPath, second: TileDrawnPath): boolean {
    return [first.start, first.end].some((end) =>
        [second.start, second.end].some((other) => distance(end, other) < 0.5)
    )
}

function polylineCrossings(
    under: readonly Point[],
    over: readonly Point[]
): { point: Point; spread: number }[] {
    const crossings: { point: Point; spread: number }[] = []
    for (let i = 1; i < under.length; i++) {
        for (let j = 1; j < over.length; j++) {
            const a = under[i - 1],
                b = under[i],
                c = over[j - 1],
                d = over[j]
            const r = { x: b.x - a.x, y: b.y - a.y }
            const q = { x: d.x - c.x, y: d.y - c.y }
            const cross = r.x * q.y - r.y * q.x
            if (Math.abs(cross) < 1e-9) continue
            const t = ((c.x - a.x) * q.y - (c.y - a.y) * q.x) / cross
            const u = ((c.x - a.x) * r.y - (c.y - a.y) * r.x) / cross
            if (t < 0 || t > 1 || u < 0 || u > 1) continue
            const sine = Math.abs(cross) / (Math.hypot(r.x, r.y) * Math.hypot(q.x, q.y))
            crossings.push({
                point: { x: a.x + r.x * t, y: a.y + r.y * t },
                spread: Math.min(3, 1 / Math.max(sine, 1 / 3))
            })
        }
    }
    return crossings
}

function distance(a: Point, b: Point): number {
    return Math.hypot(a.x - b.x, a.y - b.y)
}
