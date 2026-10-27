import type { Point } from '@tabletop/common'

export const CITY_RADIUS = 22
const BADGE_RADIUS = 11
const SMALL_BADGE_RADIUS = 8

// Slot centres for the 10, 15 and 20 houses, read clockwise from the upper left.
const SLOT_ANGLES = [-150, -30, 90]
const SLOT_DISTANCE = 11.5

export type ConnectionGeometry = { start: Point; end: Point; mid: Point; badge: number }

export function connectionGeometry(a: Point, b: Point): ConnectionGeometry {
    const length = Math.hypot(b.x - a.x, b.y - a.y)
    const ux = (b.x - a.x) / length
    const uy = (b.y - a.y) / length
    const gap = length - 2 * CITY_RADIUS
    const badge =
        gap >= 2 * BADGE_RADIUS + 6
            ? BADGE_RADIUS
            : gap >= 2 * SMALL_BADGE_RADIUS
              ? SMALL_BADGE_RADIUS
              : 0
    return {
        start: { x: a.x + ux * (CITY_RADIUS - 2), y: a.y + uy * (CITY_RADIUS - 2) },
        end: { x: b.x - ux * (CITY_RADIUS - 2), y: b.y - uy * (CITY_RADIUS - 2) },
        mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        badge
    }
}

export function slotOffset(slot: number): Point {
    const angle = (SLOT_ANGLES[slot] * Math.PI) / 180
    return { x: Math.cos(angle) * SLOT_DISTANCE, y: Math.sin(angle) * SLOT_DISTANCE }
}

/** The three spokes dividing a city into its 10, 15 and 20 slots. */
export function slotDividers(): Point[] {
    return [-90, 30, 150].map((degrees) => {
        const angle = (degrees * Math.PI) / 180
        return { x: Math.cos(angle) * CITY_RADIUS, y: Math.sin(angle) * CITY_RADIUS }
    })
}

/** An SVG path for one 120° slot of a city disc. */
export function slotSector(slot: number, radius = CITY_RADIUS): string {
    const from = ((SLOT_ANGLES[slot] - 60) * Math.PI) / 180
    const to = ((SLOT_ANGLES[slot] + 60) * Math.PI) / 180
    const x1 = Math.cos(from) * radius
    const y1 = Math.sin(from) * radius
    const x2 = Math.cos(to) * radius
    const y2 = Math.sin(to) * radius
    return `M0 0L${x1} ${y1}A${radius} ${radius} 0 0 1 ${x2} ${y2}Z`
}
