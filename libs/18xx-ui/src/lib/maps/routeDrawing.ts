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

/** An extension's dashes: drawn and gap lengths, in tile units. */
export const ExtensionDash = { drawn: 4, gap: 3 } as const

type Traversal = { reversed: boolean; travelled: number }

/** How far along a path's length its points lie, from its start, by even sampling. */
function pathLength(path: TileDrawnPath): number {
    const samples = Array.from({ length: 65 }, (_, index) => tilePathPoint(path, index / 64))
    return samples
        .slice(1)
        .reduce(
            (sum, point, index) =>
                sum + Math.hypot(point.x - samples[index].x, point.y - samples[index].y),
            0
        )
}

/**
 * Where each extension path's dashes pick up, so they run on unbroken from tile to tile: the
 * length travelled before it, and whether the extension runs it from its end to its start.
 */
function extensionTraversals(scene: MapDrawing, route: MapRoute): Map<string, Traversal> {
    const traversals = new Map<string, Traversal>()
    const world = (segment: RoutePath) => {
        const entry = scene.locations.find(
            (location) => location.location.id === segment.locationId
        )
        const path = entry?.drawing.paths.find((candidate) => candidate.id === segment.pathId)
        assertExists(entry, `Missing route location ${segment.locationId}`)
        assertExists(path, `Missing route path ${segment.pathId}`)
        const at = (point: Point) => ({ x: entry.center.x + point.x, y: entry.center.y + point.y })
        return { path, start: at(path.start), end: at(path.end) }
    }
    const near = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y) < 1
    const last = route.segments.at(-1)
    let joint: Point | undefined
    if (last) {
        const { start, end } = world(last)
        const first = route.extension?.[0]
        const firstEnds = first ? world(first) : undefined
        joint =
            firstEnds &&
            [start, end].find((point) => near(point, firstEnds.start) || near(point, firstEnds.end))
    }
    let travelled = 0
    for (const segment of route.extension ?? []) {
        const { path, start, end } = world(segment)
        const reversed = !!joint && near(joint, end)
        traversals.set(`${segment.locationId} ${segment.pathId}`, { reversed, travelled })
        travelled += pathLength(path)
        joint = reversed ? start : end
    }
    return traversals
}

/** The dash offset that continues an extension's dashes into a path, as SVG dashes run. */
function extensionDashOffset(path: TileDrawnPath, traversal: Traversal | undefined): number {
    if (!traversal) return 0
    const period = ExtensionDash.drawn + ExtensionDash.gap
    const offset = traversal.reversed
        ? ExtensionDash.drawn - (traversal.travelled + pathLength(path))
        : traversal.travelled
    return ((offset % period) + period) % period
}

export function drawMapRoutes(scene: MapDrawing, routes: readonly MapRoute[]) {
    const traversals = new Map(routes.map((route) => [route.id, extensionTraversals(scene, route)]))
    return scene.locations.flatMap((entry) => {
        if (entry.hidden) return []
        const drawn = (route: MapRoute, segments: readonly RoutePath[], extension: boolean) =>
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
                        extension,
                        dashOffset: extension
                            ? extensionDashOffset(
                                  path,
                                  traversals.get(route.id)?.get(`${segment.locationId} ${path.id}`)
                              )
                            : 0
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
        return [{ id: entry.location.id, center: entry.center, paths, cities }]
    })
}
