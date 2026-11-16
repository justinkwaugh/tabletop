import type { Point } from '@tabletop/common'
import { TILT } from './pieceGeometry.js'

// A stack's height on a badge on its top piece, TZAAR's size, at the far right of the top by
// default; on the far left if a nearer stack covers that, and at the far middle, beyond the
// hole, if it covers both.
export type BadgeSpot = 'right' | 'left' | 'middle'

export const BADGE = { radius: 0.27, font: 0.37, across: 0.6, along: 0.42, middle: 0.66 }

// Where a badge sits from the centre of the top face, over the piece's radius.
export function badgeOffset(spot: BadgeSpot, radius: number): Point {
    if (spot === 'middle') return { x: 0, y: -BADGE.middle * radius * TILT }
    return {
        x: (spot === 'right' ? 1 : -1) * BADGE.across * radius,
        y: -BADGE.along * radius * TILT
    }
}

// A stack on screen: where its space is, the height of its top face and of its bottom rim.
export type StandingStack = { center: Point; top: number; base: number }

// Whether a point lies within a stack's outline: its top face, its side, its bottom rim.
function within(stack: StandingStack, point: Point, radius: number): boolean {
    const dx = (point.x - stack.center.x) / radius
    if (Math.abs(dx) > 1) return false
    const half = Math.sqrt(1 - dx * dx) * radius * TILT
    return point.y >= stack.top - half && point.y <= stack.base + half
}

function covered(at: Point, radius: number, nearer: readonly StandingStack[]): boolean {
    const r = BADGE.radius * radius
    const rim = Array.from({ length: 8 }, (_, index) => {
        const angle = (index * Math.PI) / 4
        return { x: at.x + r * Math.cos(angle), y: at.y + r * Math.sin(angle) }
    })
    return nearer.some((stack) => [at, ...rim].some((point) => within(stack, point, radius)))
}

export function badgeSpot(
    stack: StandingStack,
    nearer: readonly StandingStack[],
    radius: number
): BadgeSpot {
    for (const spot of ['right', 'left'] as const) {
        const offset = badgeOffset(spot, radius)
        const at = { x: stack.center.x + offset.x, y: stack.top + offset.y }
        if (!covered(at, radius, nearer)) return spot
    }
    return 'middle'
}
