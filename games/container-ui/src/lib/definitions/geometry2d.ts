import type { Point } from '@tabletop/common'

export type PolygonBounds = {
    minX: number
    minY: number
    maxX: number
    maxY: number
}

const EPSILON = 1e-6

export function distanceBetween(a: Point, b: Point): number {
    return Math.hypot(b.x - a.x, b.y - a.y)
}

export function distanceFromPointToPolygon(point: Point, polygon: Point[]): number {
    if (pointInPolygon(point, polygon)) {
        return 0
    }

    let minDistance = Number.POSITIVE_INFINITY
    for (let index = 0; index < polygon.length; index += 1) {
        const start = polygon[index]!
        const end = polygon[(index + 1) % polygon.length]!
        minDistance = Math.min(minDistance, distanceFromPointToSegment(point, start, end))
    }

    return minDistance
}

export function distanceBetweenPolygons(a: Point[], b: Point[]): number {
    if (polygonsIntersect(a, b)) {
        return 0
    }

    let minDistance = Number.POSITIVE_INFINITY

    for (let index = 0; index < a.length; index += 1) {
        const start = a[index]!
        const end = a[(index + 1) % a.length]!
        for (const point of b) {
            minDistance = Math.min(minDistance, distanceFromPointToSegment(point, start, end))
        }
    }

    for (let index = 0; index < b.length; index += 1) {
        const start = b[index]!
        const end = b[(index + 1) % b.length]!
        for (const point of a) {
            minDistance = Math.min(minDistance, distanceFromPointToSegment(point, start, end))
        }
    }

    return minDistance
}

export function rotatePoint(point: Point, angleRadians: number): Point {
    const cos = Math.cos(angleRadians)
    const sin = Math.sin(angleRadians)
    return {
        x: point.x * cos - point.y * sin,
        y: point.x * sin + point.y * cos
    }
}

export function translatePoint(point: Point, offset: Point): Point {
    return {
        x: point.x + offset.x,
        y: point.y + offset.y
    }
}

export function getPolygonBounds(polygon: Point[]): PolygonBounds {
    const xs = polygon.map((point) => point.x)
    const ys = polygon.map((point) => point.y)
    return {
        minX: Math.min(...xs),
        minY: Math.min(...ys),
        maxX: Math.max(...xs),
        maxY: Math.max(...ys)
    }
}

export function inflateBounds(bounds: PolygonBounds, amount: number): PolygonBounds {
    return {
        minX: bounds.minX - amount,
        minY: bounds.minY - amount,
        maxX: bounds.maxX + amount,
        maxY: bounds.maxY + amount
    }
}

export function boundsOverlap(a: PolygonBounds, b: PolygonBounds): boolean {
    return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY
}

export function polygonFromRect(x: number, y: number, width: number, height: number): Point[] {
    return [
        { x, y },
        { x: x + width, y },
        { x: x + width, y: y + height },
        { x, y: y + height }
    ]
}

export function pointInPolygon(point: Point, polygon: Point[]): boolean {
    let inside = false

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const pi = polygon[i]!
        const pj = polygon[j]!
        const intersects =
            pi.y > point.y !== pj.y > point.y &&
            point.x <
                ((pj.x - pi.x) * (point.y - pi.y)) / ((pj.y - pi.y) || EPSILON) + pi.x

        if (intersects) {
            inside = !inside
        }
    }

    return inside
}

export function polygonsIntersect(a: Point[], b: Point[]): boolean {
    const aBounds = getPolygonBounds(a)
    const bBounds = getPolygonBounds(b)
    if (!boundsOverlap(aBounds, bBounds)) {
        return false
    }

    for (let i = 0; i < a.length; i += 1) {
        const a1 = a[i]!
        const a2 = a[(i + 1) % a.length]!
        for (let j = 0; j < b.length; j += 1) {
            const b1 = b[j]!
            const b2 = b[(j + 1) % b.length]!
            if (segmentsIntersect(a1, a2, b1, b2)) {
                return true
            }
        }
    }

    return pointInPolygon(a[0]!, b) || pointInPolygon(b[0]!, a)
}

function segmentsIntersect(a1: Point, a2: Point, b1: Point, b2: Point): boolean {
    const d1 = cross(subtract(a2, a1), subtract(b1, a1))
    const d2 = cross(subtract(a2, a1), subtract(b2, a1))
    const d3 = cross(subtract(b2, b1), subtract(a1, b1))
    const d4 = cross(subtract(b2, b1), subtract(a2, b1))

    if (
        ((d1 > EPSILON && d2 < -EPSILON) || (d1 < -EPSILON && d2 > EPSILON)) &&
        ((d3 > EPSILON && d4 < -EPSILON) || (d3 < -EPSILON && d4 > EPSILON))
    ) {
        return true
    }

    return (
        isPointOnSegment(b1, a1, a2) ||
        isPointOnSegment(b2, a1, a2) ||
        isPointOnSegment(a1, b1, b2) ||
        isPointOnSegment(a2, b1, b2)
    )
}

function isPointOnSegment(point: Point, start: Point, end: Point): boolean {
    const crossValue = cross(subtract(point, start), subtract(end, start))
    if (Math.abs(crossValue) > EPSILON) {
        return false
    }

    const dotValue = dot(subtract(point, start), subtract(point, end))
    return dotValue <= EPSILON
}

function subtract(a: Point, b: Point): Point {
    return { x: a.x - b.x, y: a.y - b.y }
}

function distanceFromPointToSegment(point: Point, start: Point, end: Point): number {
    const segment = subtract(end, start)
    const segmentLengthSquared = dot(segment, segment)
    if (segmentLengthSquared <= EPSILON) {
        return distanceBetween(point, start)
    }

    const pointOffset = subtract(point, start)
    const projection = Math.max(0, Math.min(1, dot(pointOffset, segment) / segmentLengthSquared))
    const closestPoint = {
        x: start.x + segment.x * projection,
        y: start.y + segment.y * projection
    }

    return distanceBetween(point, closestPoint)
}

function dot(a: Point, b: Point): number {
    return a.x * b.x + a.y * b.y
}

function cross(a: Point, b: Point): number {
    return a.x * b.y - a.y * b.x
}
