import type { Point } from '@tabletop/common'

export function pointDistance(a: Point, b: Point) {
    return Math.hypot(a.x - b.x, a.y - b.y)
}
