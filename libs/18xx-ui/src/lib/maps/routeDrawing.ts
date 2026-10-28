import { assertExists, type Point } from '@tabletop/common'
import type { RoutePath } from '@tabletop/18xx'
import type { TileDrawnNode } from '../tiles/tileDrawing.js'
import { tilePathPoint, type TileDrawnPath } from '../tiles/tileTrackGeometry.js'
import type { MapDrawing, MapRoute } from './mapDrawing.js'

export function cityOutline(node: TileDrawnNode): string {
    const radius = node.slots.length
        ? node.slotRadius + (node.slots.length > 1 ? 1.5 : 0.55)
        : node.dotRadius + 0.35
    const points = node.slots.length ? node.slots : [node.center]
    if (points.length === 1) {
        const { x, y } = points[0]
        return `M ${x + radius} ${y} A ${radius} ${radius} 0 1 1 ${x - radius} ${y} A ${radius} ${radius} 0 1 1 ${x + radius} ${y} Z`
    }
    const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y)
    const cross = (a: Point, b: Point, c: Point) =>
        (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
    const halfHull = (input: readonly Point[]) => {
        const hull: Point[] = []
        for (const point of input) {
            while (
                hull.length >= 2 &&
                cross(hull[hull.length - 2], hull[hull.length - 1], point) <= 0
            )
                hull.pop()
            hull.push(point)
        }
        return hull.slice(0, -1)
    }
    const hull = [...halfHull(sorted), ...halfHull([...sorted].reverse())]
    const normals = hull.map((point, i) => {
        const next = hull[(i + 1) % hull.length]
        const length = Math.hypot(next.x - point.x, next.y - point.y)
        return {
            x: ((next.y - point.y) / length) * radius,
            y: ((point.x - next.x) / length) * radius
        }
    })
    return (
        hull
            .map((point, i) => {
                const previous = normals[(i + hull.length - 1) % hull.length]
                const next = normals[i]
                return `${i ? 'L' : 'M'} ${point.x + previous.x} ${point.y + previous.y} A ${radius} ${radius} 0 0 1 ${point.x + next.x} ${point.y + next.y}`
            })
            .join(' ') + ' Z'
    )
}

/** Where an extension reaches its destination: the arrow's tip at the stop, and its heading. */
export type RouteArrow = { id: string; color: string; tip: Point; angle: number }

export function drawMapRoutes(scene: MapDrawing, routes: readonly MapRoute[]) {
    return scene.locations.flatMap((entry) => {
        if (entry.hidden) return []
        const drawn = (route: MapRoute, segments: readonly RoutePath[], dashed: boolean) =>
            segments
                .filter((segment) => segment.locationId === entry.location.id)
                .map((segment) => {
                    const path = entry.drawing.paths.find((path) => path.id === segment.pathId)
                    assertExists(path, `Missing route path ${segment.pathId}`)
                    return {
                        id: `${route.id}:${path.id}`,
                        routeId: route.id,
                        color: route.color,
                        d: path.d,
                        spike: path.spike,
                        pathId: path.id,
                        dashed
                    }
                })
        const paths = routes.flatMap((route) => [
            ...drawn(route, route.segments, false),
            ...drawn(route, route.extension ?? [], true)
        ])
        if (!paths.length) return []
        const cities = entry.drawing.nodes
            .filter((node) => node.node.kind === 'city')
            .flatMap((node) => {
                const incidentIds = new Set(
                    entry.face.paths
                        .filter((path) =>
                            path.endpoints.some(
                                (endpoint) =>
                                    endpoint.kind === 'node' && endpoint.nodeId === node.node.id
                            )
                        )
                        .map((path) => path.id)
                )
                return paths.some((path) => incidentIds.has(path.pathId))
                    ? [{ id: node.node.id, d: cityOutline(node) }]
                    : []
            })
        const arrows = routes.flatMap((route): RouteArrow[] => {
            const last = route.extension?.at(-1)
            if (last?.locationId !== entry.location.id) return []
            const path = entry.drawing.paths.find((path) => path.id === last.pathId)
            const ends = entry.face.paths
                .find((path) => path.id === last.pathId)
                ?.endpoints.flatMap((end) => (end.kind === 'node' ? [end.nodeId] : []))
            const node = entry.drawing.nodes.find((node) => ends?.includes(node.node.id))
            if (!path || !node) return []
            return [{ id: `${route.id}:arrow`, color: route.color, ...arrowAtStop(path, node) }]
        })
        return [{ id: entry.location.id, center: entry.center, paths, cities, arrows }]
    })
}

const HeadingRun = 6

/** The arrow's tip where the track meets the stop's outline, pointing along the track into it. */
function arrowAtStop(path: TileDrawnPath, node: TileDrawnNode): { tip: Point; angle: number } {
    const fromCenter = (point: Point) =>
        Math.hypot(point.x - node.center.x, point.y - node.center.y)
    const towardNode = fromCenter(path.end) < fromCenter(path.start)
    const at = (t: number) => tilePathPoint(path, towardNode ? t : 1 - t)
    const reach = node.slots.length ? node.slotRadius + 1.5 : node.dotRadius + 4
    const nearest = (point: Point) =>
        node.slots.length
            ? Math.min(...node.slots.map((slot) => Math.hypot(point.x - slot.x, point.y - slot.y)))
            : fromCenter(point)
    const steps = 40
    const samples = Array.from({ length: steps + 1 }, (_, step) => at(step / steps))
    const found = samples.findIndex((point) => nearest(point) <= reach)
    const reached = found < 0 ? steps : found
    const tip = samples[reached]
    const before =
        samples
            .slice(0, Math.max(reached, 1))
            .findLast((point) => Math.hypot(point.x - tip.x, point.y - tip.y) >= HeadingRun) ??
        samples[0]
    return { tip, angle: (Math.atan2(tip.y - before.y, tip.x - before.x) * 180) / Math.PI }
}
