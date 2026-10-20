import type { Point } from '@tabletop/common'

/** The corners of a convex shape, in order round it either way. */
export type ConvexOutline = readonly Point[]

const PARALLEL = 1e-9
const SAME_SLIDE = 0.5

function dot(a: Point, b: Point): number {
    return a.x * b.x + a.y * b.y
}

function edgeNormals(outline: ConvexOutline): Point[] {
    return outline.map((corner, index) => {
        const next = outline[(index + 1) % outline.length]
        const length = Math.hypot(next.x - corner.x, next.y - corner.y)
        return { x: (corner.y - next.y) / length, y: (next.x - corner.x) / length }
    })
}

function turnsClockwise(outline: ConvexOutline): boolean {
    const doubleArea = outline.reduce((sum, corner, index) => {
        const next = outline[(index + 1) % outline.length]
        return sum + corner.x * next.y - next.x * corner.y
    }, 0)
    return doubleArea > 0
}

/** A straight stroke of the given half width from one point to another. */
export function strokeOutline(from: Point, to: Point, halfWidth: number): Point[] {
    const length = Math.hypot(to.x - from.x, to.y - from.y) || 1
    const side = {
        x: ((from.y - to.y) / length) * halfWidth,
        y: ((to.x - from.x) / length) * halfWidth
    }
    return [
        { x: from.x + side.x, y: from.y + side.y },
        { x: to.x + side.x, y: to.y + side.y },
        { x: to.x - side.x, y: to.y - side.y },
        { x: from.x - side.x, y: from.y - side.y }
    ]
}

function cross(origin: Point, a: Point, b: Point): number {
    return (a.x - origin.x) * (b.y - origin.y) - (a.y - origin.y) * (b.x - origin.x)
}

/**
 * Every place the centre of a level box of the given half sizes can stand and still touch the
 * outline: the outline grown by the box, the hull of its corners moved to the box's corners.
 */
export function grownByLevelBox(outline: ConvexOutline, halfX: number, halfY: number): Point[] {
    const points = outline
        .flatMap((corner) =>
            [-halfX, halfX].flatMap((dx) =>
                [-halfY, halfY].map((dy) => ({ x: corner.x + dx, y: corner.y + dy }))
            )
        )
        .sort((a, b) => a.x - b.x || a.y - b.y)
    const chain = (ordered: Point[]) =>
        ordered.reduce<Point[]>((hull, point) => {
            while (
                hull.length >= 2 &&
                cross(hull[hull.length - 2], hull[hull.length - 1], point) <= 0
            ) {
                hull.pop()
            }
            hull.push(point)
            return hull
        }, [])
    const lower = chain(points)
    const upper = chain([...points].reverse())
    return [...lower.slice(0, -1), ...upper.slice(0, -1)]
}

/** Whether the point lies inside the outline or on its edge. */
export function outlineHolds(outline: ConvexOutline, point: Point): boolean {
    let sign = 0
    for (let index = 0; index < outline.length; index++) {
        const turn = cross(outline[index], outline[(index + 1) % outline.length], point)
        if (turn !== 0) {
            if (sign !== 0 && Math.sign(turn) !== sign) {
                return false
            }
            sign = Math.sign(turn)
        }
    }
    return true
}

/** The outline moved out by `distance` on every side, its corners kept sharp. */
export function grownOutline(outline: ConvexOutline, distance: number): Point[] {
    const sign = turnsClockwise(outline) ? -1 : 1
    const normals = edgeNormals(outline).map(({ x, y }) => ({ x: x * sign, y: y * sign }))
    return outline.map((corner, index) => {
        const before = normals[(index + outline.length - 1) % outline.length]
        const after = normals[index]
        const mitre = distance / (1 + dot(before, after))
        return {
            x: corner.x + (before.x + after.x) * mitre,
            y: corner.y + (before.y + after.y) * mitre
        }
    })
}

/**
 * Corners of an outline round an arc, from angle `from` to `to` in degrees, that holds the arc:
 * where the arc's tangents at its ends and at even steps between meet.
 */
export function aroundArc(
    centre: Point,
    radius: number,
    from: number,
    to: number,
    steps: number
): Point[] {
    const step = (to - from) / steps
    const reach = radius / Math.cos((step * Math.PI) / 360)
    const at = (degrees: number, distance: number) => ({
        x: centre.x + distance * Math.cos((degrees * Math.PI) / 180),
        y: centre.y + distance * Math.sin((degrees * Math.PI) / 180)
    })
    return [
        at(from, radius),
        ...Array.from({ length: steps }, (_, index) => at(from + step * (index + 0.5), reach)),
        at(to, radius)
    ]
}

function spanAlong(outline: ConvexOutline, axis: Point): [number, number] {
    let low = Infinity
    let high = -Infinity
    for (const corner of outline) {
        const reach = dot(corner, axis)
        low = Math.min(low, reach)
        high = Math.max(high, reach)
    }
    return [low, high]
}

export function outlinesOverlap(a: ConvexOutline, b: ConvexOutline): boolean {
    return [...edgeNormals(a), ...edgeNormals(b)].every((axis) => {
        const [aLow, aHigh] = spanAlong(a, axis)
        const [bLow, bHigh] = spanAlong(b, axis)
        return aHigh > bLow && bHigh > aLow
    })
}

/** The open range of slides along `direction` over which `moving` overlaps `fixed`, if any. */
export function overlapWhileSliding(
    moving: ConvexOutline,
    fixed: ConvexOutline,
    direction: Point
): [number, number] | undefined {
    let from = -Infinity
    let to = Infinity
    for (const axis of [...edgeNormals(moving), ...edgeNormals(fixed)]) {
        const [movingLow, movingHigh] = spanAlong(moving, axis)
        const [fixedLow, fixedHigh] = spanAlong(fixed, axis)
        const rate = dot(direction, axis)
        if (Math.abs(rate) < PARALLEL) {
            if (movingHigh <= fixedLow || fixedHigh <= movingLow) {
                return undefined
            }
            continue
        }
        const ends = [(fixedLow - movingHigh) / rate, (fixedHigh - movingLow) / rate]
        from = Math.max(from, Math.min(...ends))
        to = Math.min(to, Math.max(...ends))
    }
    return from < to ? [from, to] : undefined
}

/**
 * The shortest slide along `direction` that leaves `moving` clear of every obstacle. Between two
 * slides of the same length it takes the one towards the right of the board, or down it, so shapes
 * sliding along one line go the same way.
 */
export function shortestClearSlide(
    moving: ConvexOutline,
    obstacles: readonly ConvexOutline[],
    direction: Point
): number {
    const across = { x: -direction.y, y: direction.x }
    const [movingLow, movingHigh] = spanAlong(moving, across)
    const overlaps = obstacles.flatMap((obstacle) => {
        const [low, high] = spanAlong(obstacle, across)
        const overlap =
            high > movingLow && low < movingHigh
                ? overlapWhileSliding(moving, obstacle, direction)
                : undefined
        return overlap ? [overlap] : []
    })
    const clear = [0, ...overlaps.flat()].filter((slide) =>
        overlaps.every(([from, to]) => slide <= from || slide >= to)
    )
    const shortest = Math.min(...clear.map(Math.abs))
    const forward = Math.abs(direction.x) > PARALLEL ? direction.x : direction.y
    return clear
        .filter((slide) => Math.abs(slide) - shortest < SAME_SLIDE)
        .reduce((best, slide) => (slide * forward > best * forward ? slide : best))
}
