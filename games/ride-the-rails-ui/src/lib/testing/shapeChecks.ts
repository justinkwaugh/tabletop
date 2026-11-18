import type { BoundingBox, Point, RectangleDimensions } from '@tabletop/common'

export function boxesOverlap(a: BoundingBox, b: BoundingBox): boolean {
    return (
        a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
    )
}

export function boxInside(inner: BoundingBox, outer: BoundingBox): boolean {
    return (
        inner.x >= outer.x &&
        inner.y >= outer.y &&
        inner.x + inner.width <= outer.x + outer.width &&
        inner.y + inner.height <= outer.y + outer.height
    )
}

export function centredBox(center: Point & RectangleDimensions): BoundingBox {
    return {
        x: center.x - center.width / 2,
        y: center.y - center.height / 2,
        width: center.width,
        height: center.height
    }
}

export function discBox(disc: Point & { radius: number }): BoundingBox {
    return centredBox({ ...disc, width: 2 * disc.radius, height: 2 * disc.radius })
}

export function boxCorners(box: BoundingBox): Point[] {
    return [
        { x: box.x, y: box.y },
        { x: box.x + box.width, y: box.y },
        { x: box.x + box.width, y: box.y + box.height },
        { x: box.x, y: box.y + box.height }
    ]
}

/** For a convex polygon with its corners in clockwise screen order. */
export function insideConvexPolygon(point: Point, corners: readonly Point[]): boolean {
    return corners.every((from, index) => {
        const to = corners[(index + 1) % corners.length]
        const cross = (to.x - from.x) * (point.y - from.y) - (to.y - from.y) * (point.x - from.x)
        return cross >= -1e-9
    })
}

/**
 * How far a disc reaches past a convex polygon's edge: the most, over its sides, of the disc's
 * distance outside each (negative inside).
 */
export function reachPastConvex(point: Point, corners: readonly Point[], radius = 0): number {
    const center = {
        x: corners.reduce((sum, corner) => sum + corner.x, 0) / corners.length,
        y: corners.reduce((sum, corner) => sum + corner.y, 0) / corners.length
    }
    return Math.max(
        ...corners.map((from, index) => {
            const to = corners[(index + 1) % corners.length]
            const length = Math.hypot(to.x - from.x, to.y - from.y)
            let nx = (to.y - from.y) / length
            let ny = -(to.x - from.x) / length
            // Point the normal away from the polygon's centre.
            if ((from.x - center.x) * nx + (from.y - center.y) * ny < 0) {
                nx = -nx
                ny = -ny
            }
            return (point.x - from.x) * nx + (point.y - from.y) * ny + radius
        })
    )
}

/** A hexagon of this corner radius round the origin, its corners at the frame's angles. */
export function frameHexagon(cornerAngles: readonly number[], radius: number): Point[] {
    return cornerAngles.map((degrees) => {
        const radians = (degrees * Math.PI) / 180
        return { x: radius * Math.sin(radians), y: -radius * Math.cos(radians) }
    })
}
