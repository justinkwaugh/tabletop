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
