import { assertExists, type Point } from '@tabletop/common'
import { getFountain, shopsNextTo, type Route, type ShopId } from '@tabletop/marracash'
import { cellCenter, shopRect, ShopTileInset } from '$lib/utils/boardGeometry.js'
import { EntranceRadii, FountainRadii } from '$lib/utils/fountainShape.js'

export type DashPattern = { dash: number; gap: number }

export const FlowSpeed = 48
export const RouteDash: DashPattern = { dash: 18, gap: 26 }
export const BranchDash: DashPattern = { dash: 8, gap: 8 }

export function flowSeconds(pattern: DashPattern): number {
    return (pattern.dash + pattern.gap) / FlowSpeed
}

export const PulseSeconds = flowSeconds(RouteDash)
export const PulsePeakSeconds = RouteDash.dash / FlowSpeed

// Lines are drawn end-to-start so the dash pattern is anchored at the
// destination: arrivals, and the pulse peak, then line up on any route length.
export function flowPoints(line: Point[]): string {
    return line
        .toReversed()
        .map((point) => `${point.x},${point.y}`)
        .join(' ')
}

function cardinalEdgeDistance(entrance: boolean): number {
    return entrance ? EntranceRadii.trim : FountainRadii.rim * Math.cos(Math.PI / 8)
}

// A route runs between the fountains' outlines, not their centres.
export function routeLine(route: Route): Point[] {
    const origin = getFountain(route.from)
    const destination = getFountain(route.to)
    const centers = [origin.coords, ...route.path].map(cellCenter)
    const [first, second] = centers
    const [beforeLast, last] = centers.slice(-2)
    assertExists(second, `Route from ${route.from} has no steps`)
    const start = edgeToward(first, second, origin.entrance)
    const end = edgeToward(last, beforeLast, destination.entrance)
    return [start, ...centers.slice(1, -1), end]
}

function edgeToward(center: Point, toward: Point, entrance: boolean): Point {
    const edge = cardinalEdgeDistance(entrance)
    const distance = Math.hypot(toward.x - center.x, toward.y - center.y)
    return {
        x: center.x + ((toward.x - center.x) * edge) / distance,
        y: center.y + ((toward.y - center.y) * edge) / distance
    }
}

export function shopBranch(route: Route, shopId: ShopId): [Point, Point] {
    const step = route.path.find((coords) => shopsNextTo(coords).includes(shopId))
    assertExists(step, `Route never passes shop ${shopId}`)
    const start = cellCenter(step)
    const rect = shopRect(shopId, ShopTileInset)
    const end = {
        x: Math.min(Math.max(start.x, rect.x), rect.x + rect.width),
        y: Math.min(Math.max(start.y, rect.y), rect.y + rect.height)
    }
    return [start, end]
}
