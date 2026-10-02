import { assertExists, type Point } from '@tabletop/common'
import { getFountain, shopsNextTo, type Route, type ShopId } from '@tabletop/marracash'
import { cellCenter, shopRect, ShopTileInset } from '$lib/utils/boardGeometry.js'
import { EntranceRadii, FountainRadii } from '$lib/utils/fountainShape.js'

// Dashes travel at one speed everywhere; the destination pulses once per
// route dash period, so each dash that reaches the fountain feeds one pulse.
export const FlowSpeed = 48
export const RouteDash = { dash: 18, gap: 26 }
export const BranchDash = { dash: 8, gap: 8 }
export const PulseSeconds = (RouteDash.dash + RouteDash.gap) / FlowSpeed

// Flow lines run from their end back to their start, so the dash pattern is
// anchored where the dashes arrive. A dash's tail therefore finishes reaching
// the destination at the same moment in every cycle, whatever the route's
// length, and the pulse peaks then.
export const PulsePeakSeconds = RouteDash.dash / FlowSpeed

export function flowSeconds(pattern: { dash: number; gap: number }): number {
    return (pattern.dash + pattern.gap) / FlowSpeed
}

export function routeLine(route: Route): Point[] {
    const destination = getFountain(route.to)
    const center = cellCenter(destination.coords)
    const last = cellCenter(route.path.at(-2) ?? getFountain(route.from).coords)
    // Routes reach a fountain along a cardinal direction: a star's point, or
    // the middle of an octagon's side.
    const edge = destination.entrance
        ? EntranceRadii.trim
        : FountainRadii.rim * Math.cos(Math.PI / 8)
    const distance = Math.hypot(last.x - center.x, last.y - center.y)
    const stop = {
        x: center.x + ((last.x - center.x) * edge) / distance,
        y: center.y + ((last.y - center.y) * edge) / distance
    }
    return [...[getFountain(route.from).coords, ...route.path.slice(0, -1)].map(cellCenter), stop]
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
