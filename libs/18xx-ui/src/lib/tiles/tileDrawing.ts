import {
    assertExists,
    calculateHexGeometry,
    ClockwiseFlatHexDirections,
    ClockwisePointyHexDirections,
    HexOrientation,
    type Point
} from '@tabletop/common'
import {
    rotateTileEdge,
    tileEdgeDirection,
    type TileEndpoint,
    type TileFace,
    type TileNode,
    type TilePath,
    type TileRotation
} from '@tabletop/18xx'
import {
    createArcTilePath,
    createCubicTilePath,
    createEdgeTilePath,
    createStraightTilePath,
    tilePathPoint,
    type TileDrawnPath
} from './tileTrackGeometry.js'
import { stagedRevenueLayout, type RevenueCell } from './stagedRevenueLayout.js'

export type { TileDrawnPath } from './tileTrackGeometry.js'

export type TileLayout = {
    annotationExclusions?: readonly Point[]
    nodePositions?: Readonly<Record<string, Point>>
    townTrackPositions?: Readonly<Record<string, number>>
    pathControls?: Readonly<Record<string, readonly [Point, Point]>>
    revenuePositions?: Readonly<Record<string, Point>>
    revenuePositionsByRotation?: Partial<Record<TileRotation, Readonly<Record<string, Point>>>>
    revenuePositionsByOrientation?: Partial<Record<HexOrientation, Readonly<Record<string, Point>>>>
    labelPosition?: Point
}

export type TileDrawnNode = {
    node: TileNode
    center: Point
    slots: readonly Point[]
    revenuePosition: Point
    revenueCells: readonly RevenueCell[]
    townAngle?: number
}

export type TileDrawing = {
    polygon: string
    paths: readonly TileDrawnPath[]
    nodes: readonly TileDrawnNode[]
    labelPosition: Point
    symbolPosition: Point
    upgradeCostPosition: Point
}

export function createTileDrawing(
    face: TileFace,
    orientation: HexOrientation = HexOrientation.Flat,
    rotation: TileRotation = 0,
    layout: TileLayout = {}
): TileDrawing {
    const geometry = calculateHexGeometry(
        { orientation, dimensions: { radius: 50 } },
        { q: 0, r: 0 }
    )
    const angle =
        ((rotation * 60 + (orientation === HexOrientation.Pointy ? 30 : 0)) * Math.PI) / 180
    const centers = new Map<string, Point>()
    const automaticTownPaths = new Map<string, readonly TilePath[]>()
    for (const node of face.nodes) {
        if (node.kind === 'town' && !layout.nodePositions?.[node.id]) {
            const incident = face.paths.filter((path) =>
                path.endpoints.some(
                    (endpoint) => endpoint.kind === 'node' && endpoint.nodeId === node.id
                )
            )
            if (
                incident.length === 2 &&
                incident.every(
                    (path) =>
                        !layout.pathControls?.[path.id] &&
                        path.endpoints.some((endpoint) => endpoint.kind === 'edge')
                )
            )
                automaticTownPaths.set(node.id, incident)
        }
        const position =
            layout.nodePositions?.[node.id] ??
            (face.nodes.length === 1 ? { x: 0, y: 0 } : undefined)
        if (!position && automaticTownPaths.has(node.id)) continue
        assertExists(position, `Tile layout requires a position for node ${node.id}`)
        centers.set(node.id, orientPoint(position, angle))
    }

    function endpointPosition(endpoint: TileEndpoint): Point {
        if (endpoint.kind === 'node') {
            const center = centers.get(endpoint.nodeId)
            assertExists(center, `Unknown tile node ${endpoint.nodeId}`)
            return center
        }
        const edge = rotateTileEdge(endpoint.edge, rotation)
        const index =
            orientation === HexOrientation.Flat
                ? ClockwiseFlatHexDirections.indexOf(tileEdgeDirection(edge, orientation))
                : ClockwisePointyHexDirections.indexOf(tileEdgeDirection(edge, orientation))
        const a = geometry.vertices[index]
        const b = geometry.vertices[(index + 1) % 6]
        return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
    }

    const townPaths = new Map<string, TileDrawnPath>()
    for (const [nodeId, incident] of automaticTownPaths) {
        const edges = incident.map((path) =>
            path.endpoints.find((endpoint) => endpoint.kind === 'edge')
        )
        const a = endpointPosition(edges[0]!)
        const b = endpointPosition(edges[1]!)
        const curve = createEdgeTilePath(nodeId, a, b)
        const middle = tilePathPoint(curve, layout.townTrackPositions?.[nodeId] ?? 0.5)
        centers.set(nodeId, middle)
        incident.forEach((path, index) => {
            const edge = index === 0 ? a : b
            const [start, end] = path.endpoints[0].kind === 'edge' ? [edge, middle] : [middle, edge]
            townPaths.set(
                path.id,
                curve.arc
                    ? createArcTilePath(path.id, start, end, curve.arc.center)
                    : createStraightTilePath(path.id, start, end)
            )
        })
    }

    const paths = face.paths.map((path): TileDrawnPath => {
        const start = endpointPosition(path.endpoints[0])
        const end = endpointPosition(path.endpoints[1])
        const hint = layout.pathControls?.[path.id]
        const townPath = townPaths.get(path.id)
        if (townPath) return townPath
        if (!hint && path.endpoints.every((endpoint) => endpoint.kind === 'edge')) {
            return createEdgeTilePath(path.id, start, end)
        }
        const handleLength = Math.hypot(end.x - start.x, end.y - start.y) * 0.45
        const controls: readonly [Point, Point] = hint
            ? [orientPoint(hint[0], angle), orientPoint(hint[1], angle)]
            : [
                  path.endpoints[0].kind === 'edge' ? inwardControl(start, handleLength) : start,
                  path.endpoints[1].kind === 'edge' ? inwardControl(end, handleLength) : end
              ]
        return createCubicTilePath(path.id, start, end, controls)
    })

    const occupied: Point[] = [
        ...(layout.annotationExclusions ?? []),
        ...face.nodes.flatMap((node) => {
            const center = centers.get(node.id)
            assertExists(center, `Unknown tile node ${node.id}`)
            return node.kind === 'city' && node.stationSlots > 0
                ? stationPositions(node.stationSlots, center, angle)
                : [center]
        })
    ]
    if (face.labels.length > 0 && layout.labelPosition) {
        occupied.push(orientPoint(layout.labelPosition, angle))
    }
    const nodes = face.nodes.map((node): TileDrawnNode => {
        const center = centers.get(node.id)
        assertExists(center, `Unknown tile node ${node.id}`)
        const hint =
            layout.revenuePositionsByOrientation?.[orientation]?.[node.id] ??
            layout.revenuePositionsByRotation?.[rotation]?.[node.id] ??
            layout.revenuePositions?.[node.id]
        const revenueRadius =
            node.kind !== 'junction' && node.revenue.kind === 'staged'
                ? 24
                : node.kind === 'city' && node.stationSlots >= 3
                  ? 35
                  : 32
        const revenuePosition = hint
            ? orientPoint(hint, angle)
            : annotationPosition(
                  paths,
                  occupied,
                  revenueRadius,
                  node.kind !== 'junction' && node.revenue.kind === 'fixed'
                      ? geometry.vertices
                      : undefined
              )
        const revenueCells = node.kind === 'junction' ? [] : stagedRevenueLayout(node.revenue, revenuePosition, geometry.vertices, paths, occupied)
        if (node.kind !== 'junction') occupied.push(...(revenueCells.length ? revenueCells : [revenuePosition]))
        const townAngle = automaticTownPaths.has(node.id)
            ? townMarkerAngle(center, paths)
            : undefined
        return {
            node,
            center,
            slots: node.kind === 'city' ? stationPositions(node.stationSlots, center, angle) : [],
            revenuePosition,
            revenueCells,
            townAngle
        }
    })
    const labelPosition = layout.labelPosition
        ? orientPoint(layout.labelPosition, angle)
        : labelAnnotationPosition(paths, occupied, geometry.vertices, face.labels.join(' '))
    if (face.labels.length) occupied.push(labelPosition)
    const symbolPosition = annotationPosition(paths, occupied, 29)
    if (face.symbols?.length) occupied.push(symbolPosition)
    const upgradeCostPosition = annotationPosition(paths, occupied, 31)
    return {
        polygon: geometry.vertices.map((point) => `${point.x},${point.y}`).join(' '),
        paths,
        nodes,
        labelPosition,
        symbolPosition,
        upgradeCostPosition
    }
}

function orientPoint(point: Point, angle: number): Point {
    return {
        x: point.x * Math.cos(angle) - point.y * Math.sin(angle),
        y: point.x * Math.sin(angle) + point.y * Math.cos(angle)
    }
}

function inwardControl(point: Point, distance: number): Point {
    const scale = 1 - distance / Math.hypot(point.x, point.y)
    return { x: point.x * scale, y: point.y * scale }
}

function stationPositions(count: number, center: Point, rotation: number): Point[] {
    return Array.from({ length: count }, (_, index) => {
        if (count === 1) return center
        const radius = count === 2 ? 11 : 11 / Math.sin(Math.PI / count)
        const angle =
            rotation + (count === 2 ? index * Math.PI : (index * Math.PI * 2) / count - Math.PI / 2)
        return { x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius }
    })
}

function townMarkerAngle(center: Point, paths: readonly TileDrawnPath[]): number {
    const path = paths.find((path) => path.start === center || path.end === center)
    if (!path) return 0
    const control = path.start === center ? path.controls[0] : path.controls[1]
    const tangent =
        control.x === center.x && control.y === center.y
            ? path.start === center
                ? path.end
                : path.start
            : control
    return (Math.atan2(tangent.y - center.y, tangent.x - center.x) * 180) / Math.PI + 90
}

const LabelFontSize = 12
const LabelGlyphWidth = 0.7 * LabelFontSize
const LabelOutline = 1.25
const MarkerRadius = 10

function labelAnnotationPosition(
    paths: readonly TileDrawnPath[],
    occupied: readonly Point[],
    vertices: readonly Point[],
    label: string
): Point {
    const halfWidth = (label.length * LabelGlyphWidth) / 2 + LabelOutline
    const halfHeight = LabelFontSize / 2 + LabelOutline
    const clearOfMarkers = (center: Point) =>
        occupied.every(
            (marker) =>
                Math.hypot(
                    Math.max(0, Math.abs(marker.x - center.x) - halfWidth),
                    Math.max(0, Math.abs(marker.y - center.y) - halfHeight)
                ) >= MarkerRadius
        )
    const fits = (center: Point) =>
        clearOfMarkers(center) &&
        [-1, 1].every((horizontal) =>
            [-1, 1].every((vertical) =>
                insideHex(vertices, {
                    x: center.x + horizontal * halfWidth,
                    y: center.y + vertical * halfHeight
                })
            )
        )
    const preferred = 31.5
    const radii = Array.from({ length: 9 }, (_, step) => preferred - step * 2).flatMap(
        (radius, step) => (step ? [radius, preferred + step * 2] : [radius])
    )
    for (const radius of radii) {
        const position = annotationPosition(paths, occupied, radius, undefined, fits)
        if (fits(position)) return position
    }
    return annotationPosition(paths, occupied, preferred)
}

function insideHex(vertices: readonly Point[], point: Point): boolean {
    return vertices.every((a, index) => {
        const b = vertices[(index + 1) % vertices.length]
        return (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x) >= 0
    })
}

function annotationPosition(
    paths: readonly TileDrawnPath[],
    occupied: readonly Point[],
    radius: number,
    corners?: readonly Point[],
    fits: (point: Point) => boolean = () => true
): Point {
    const samples = paths.flatMap((path) =>
        Array.from({ length: 21 }, (_, index) => tilePathPoint(path, index / 20))
    )
    const candidates = corners
        ? corners.map((point) => ({ x: (point.x * radius) / 50, y: (point.y * radius) / 50 }))
        : Array.from({ length: 12 }, (_, index) => {
              const angle = ((index * 30 - 90) * Math.PI) / 180
              return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) }
          })
    function clearance(point: Point): number {
        return Math.min(
            ...samples.map((sample) => Math.hypot(point.x - sample.x, point.y - sample.y)),
            ...occupied.map((sample) => Math.hypot(point.x - sample.x, point.y - sample.y) - 10)
        )
    }
    const fitting = candidates.filter(fits)
    return (fitting.length ? fitting : candidates).reduce((best, point) =>
        clearance(point) > clearance(best) ? point : best
    )
}
