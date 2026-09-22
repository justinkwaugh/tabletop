import { assertExists, type Point } from '@tabletop/common'
import type { TileDrawnNode } from '../tiles/tileDrawing.js'
import type { MapDrawing, MapRoute } from './mapDrawing.js'

export function cityOutline(node: TileDrawnNode): string {
    const radius = node.slots.length > 1 ? 11.5 : node.slots.length ? 10.55 : 7
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

export function drawMapRoutes(scene: MapDrawing, routes: readonly MapRoute[]) {
    return scene.locations.flatMap((entry) => {
        if (entry.hidden) return []
        const paths = routes.flatMap((route) =>
            route.segments
                .filter((segment) => segment.locationId === entry.location.id)
                .map((segment) => {
                    const path = entry.drawing.paths.find((path) => path.id === segment.pathId)
                    assertExists(path, `Missing route path ${segment.pathId}`)
                    return {
                        id: `${route.id}:${path.id}`,
                        routeId: route.id,
                        color: route.color,
                        d: path.d,
                        pathId: path.id
                    }
                })
        )
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
