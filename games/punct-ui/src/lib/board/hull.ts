import type { Point } from '@tabletop/common'

// The convex hull of the points, in order round it.
export function hull(points: readonly Point[]): Point[] {
    const sorted = points.toSorted((a, b) => a.x - b.x || a.y - b.y)
    const cross = (o: Point, a: Point, b: Point) =>
        (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)
    const half = (list: Point[]) => {
        const out: Point[] = []
        for (const point of list) {
            while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], point) <= 0) {
                out.pop()
            }
            out.push(point)
        }
        return out.slice(0, -1)
    }
    return [...half(sorted), ...half(sorted.toReversed())]
}
