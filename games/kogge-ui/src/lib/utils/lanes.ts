import type { Point } from '@tabletop/common'
import type { BoardGeometry } from '$lib/board/geometry.js'

export interface Curve {
    start: Point
    control: Point
    end: Point
}

export interface Lane extends Curve {
    path: string
    angle: number
}

const PULL = 0.42
const SEPARATION = 16

// A lane bows out through open water so it does not cut across the coast; the lanes of a
// city pair that run both ways sit side by side rather than on top of each other.
export function laneBetween(geometry: BoardGeometry, from: number, to: number): Lane {
    const start = geometry.harbour(from)
    const end = geometry.harbour(to)
    const mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 }
    const length = Math.hypot(end.x - start.x, end.y - start.y)
    const normal = { x: -(end.y - start.y) / length, y: (end.x - start.x) / length }
    const control = {
        x: mid.x + (geometry.seaCentre.x - mid.x) * PULL + normal.x * SEPARATION,
        y: mid.y + (geometry.seaCentre.y - mid.y) * PULL + normal.y * SEPARATION
    }
    const angle = Math.atan2(end.y - control.y, end.x - control.x)
    return {
        start,
        control,
        end,
        path: `M${start.x} ${start.y} Q${control.x} ${control.y} ${end.x} ${end.y}`,
        angle
    }
}

export function pointAlong({ start, control, end }: Curve, t: number): Point {
    const u = 1 - t
    return {
        x: u * u * start.x + 2 * u * t * control.x + t * t * end.x,
        y: u * u * start.y + 2 * u * t * control.y + t * t * end.y
    }
}

// Cogs gather around a harbour along the coast, never stacked on one another.
export function dockOffset(index: number, count: number): Point {
    const spread = 50
    const position = index - (count - 1) / 2
    return { x: position * spread, y: Math.abs(position) * 6 }
}
