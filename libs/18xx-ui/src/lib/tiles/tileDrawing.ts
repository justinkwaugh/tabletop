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

const OffboardSpikeReach = 0.6

export type TileLayout = {
    annotationExclusions?: readonly Point[]
    nodePositions?: Readonly<Record<string, Point>>
    townTrackPositions?: Readonly<Record<string, number>>
    pathControls?: Readonly<Record<string, readonly [Point, Point]>>
    revenuePositions?: Readonly<Record<string, Point>>
    revenuePositionsByRotation?: Partial<Record<TileRotation, Readonly<Record<string, Point>>>>
    revenuePositionsByOrientation?: Partial<Record<HexOrientation, Readonly<Record<string, Point>>>>
    labelPosition?: Point
    hideRevenue?: true | readonly string[]
    /** Lays staged revenue boxes out in a column or a row rather than whichever fits best. */
    revenueStack?: 'column' | 'row'
    /** Centres the revenue, with any badge beneath it on a map, on the hex's middle line. */
    revenueAlign?: 'middle'
}

export type TileDrawnNode = {
    node: TileNode
    center: Point
    slots: readonly Point[]
    revenuePosition: Point
    revenueCells: readonly RevenueCell[]
    revenueHidden: boolean
    /** Station circle radius: the style's size, reduced so neighbouring cities on the tile stay apart. */
    slotRadius: number
    townAngle?: number
    /** Radius of a town, or a city without station spaces, drawn as a dot: larger where three or more tracks meet. */
    dotRadius: number
}

/** The tile style's measurements that geometry and annotation placement depend on. */
export type TileDrawingStyle = {
    citySlotRadius?: number
    labelFontSize?: number
    longLabelFontSize?: number
    /** Printed prefixes for revenue stages that are not phases, such as D for diesel. */
    revenueStageLabels?: Readonly<Record<string, string>>
    /** Curves a lone one-station city's name over the top of the city. */
    cityNameArcs?: boolean
}

export type TileDrawing = {
    polygon: string
    /** Station circle radius the slots are spaced for. */
    citySlotRadius: number
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
    layout: TileLayout = {},
    style: TileDrawingStyle = {}
): TileDrawing {
    const citySlotRadius = style.citySlotRadius ?? DefaultCitySlotRadius
    // Annotations keep the same distance from larger station circles.
    const markerRadius = MarkerRadius + citySlotRadius - DefaultCitySlotRadius
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

    const withOffboardSpike = (
        path: (typeof face.paths)[number],
        drawn: TileDrawnPath
    ): TileDrawnPath => {
        const offboard = face.nodes.some(
            (node) =>
                node.kind === 'offboard' &&
                path.endpoints.some(
                    (endpoint) => endpoint.kind === 'node' && endpoint.nodeId === node.id
                )
        )
        if (!offboard) return drawn
        const [base, center] =
            path.endpoints[0].kind === 'edge' ? [drawn.start, drawn.end] : [drawn.end, drawn.start]
        const tip = {
            x: base.x + (center.x - base.x) * OffboardSpikeReach,
            y: base.y + (center.y - base.y) * OffboardSpikeReach
        }
        return { ...drawn, spike: { base, tip } }
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
        return withOffboardSpike(path, createCubicTilePath(path.id, start, end, controls))
    })

    const stationSlots = face.nodes.flatMap((node) => {
        const center = centers.get(node.id)
        return center && node.kind === 'city' && node.stationSlots > 0
            ? stationPositions(node.stationSlots, center, angle, citySlotRadius)
            : []
    })
    const occupied: Point[] = [
        ...(layout.annotationExclusions ?? []),
        ...face.nodes.flatMap((node) => {
            const center = centers.get(node.id)
            assertExists(center, `Unknown tile node ${node.id}`)
            return node.kind === 'city' && node.stationSlots > 0
                ? stationPositions(node.stationSlots, center, angle, citySlotRadius)
                : [center]
        })
    ]
    if (face.labels.length > 0 && layout.labelPosition) {
        occupied.push(orientPoint(layout.labelPosition, angle))
    }
    const drawnNodes = face.nodes.map((node): Omit<TileDrawnNode, 'slotRadius'> => {
        const center = centers.get(node.id)
        assertExists(center, `Unknown tile node ${node.id}`)
        const revenueHidden =
            layout.hideRevenue === true || (layout.hideRevenue?.includes(node.id) ?? false)
        const hint =
            layout.revenuePositionsByOrientation?.[orientation]?.[node.id] ??
            layout.revenuePositionsByRotation?.[rotation]?.[node.id] ??
            layout.revenuePositions?.[node.id]
        const revenueRadius =
            node.kind !== 'junction' && node.revenue.kind === 'staged'
                ? 24
                : (node.kind === 'city' && node.stationSlots >= 3 ? 35 : 32) +
                  (markerRadius - MarkerRadius) * 0.75
        const cornered = node.kind !== 'junction' && node.revenue.kind === 'fixed'
        const placed = hint
            ? orientPoint(hint, angle)
            : annotationPosition(
                  paths,
                  occupied,
                  revenueRadius,
                  cornered ? geometry.vertices : undefined,
                  undefined,
                  markerRadius
              )
        const revenuePosition =
            hint || !cornered
                ? placed
                : clearOfStations(placed, stationSlots, markerRadius, geometry.vertices)
        const revenueCells =
            node.kind === 'junction'
                ? []
                : stagedRevenueLayout(
                      node.revenue,
                      revenuePosition,
                      geometry.vertices,
                      paths,
                      occupied,
                      style.revenueStageLabels,
                      layout.revenueStack,
                      !!hint
                  )
        if (node.kind !== 'junction' && !revenueHidden)
            occupied.push(...(revenueCells.length ? revenueCells : [revenuePosition]))
        const tracks = face.paths.filter((path) =>
            path.endpoints.some(
                (endpoint) => endpoint.kind === 'node' && endpoint.nodeId === node.id
            )
        ).length
        // A town on through track, or ending a single track, is a bar across that track.
        const townAngle =
            node.kind === 'town' && (automaticTownPaths.has(node.id) || tracks === 1)
                ? townMarkerAngle(center, paths)
                : undefined
        const dotRadius = townAngle !== undefined ? 4.2 : tracks >= 3 ? 9 : 6.3
        return {
            node,
            center,
            slots:
                node.kind === 'city'
                    ? stationPositions(node.stationSlots, center, angle, citySlotRadius)
                    : [],
            revenuePosition,
            revenueCells,
            revenueHidden,
            townAngle,
            dotRadius
        }
    })
    const nodes = drawnNodes.map((drawn): TileDrawnNode => {
        const own = drawn.slots.length ? drawn.slots : [drawn.center]
        const others = drawnNodes
            .filter((other) => other !== drawn && other.node.kind === 'city')
            .flatMap((other) => other.slots)
        const nearest = Math.min(
            Infinity,
            ...own.flatMap((point) =>
                others.map((other) => Math.hypot(point.x - other.x, point.y - other.y))
            )
        )
        return { ...drawn, slotRadius: Math.min(citySlotRadius, nearest / 2 - 0.75) }
    })
    const labelPosition = layout.labelPosition
        ? orientPoint(layout.labelPosition, angle)
        : labelAnnotationPosition(
              paths,
              occupied,
              geometry.vertices,
              face.labels.join(' '),
              face.labels.join(' ').length > 2
                  ? (style.longLabelFontSize ?? style.labelFontSize ?? LabelFontSize)
                  : (style.labelFontSize ?? LabelFontSize),
              markerRadius
          )
    if (face.labels.length) occupied.push(labelPosition)
    const symbolPosition = annotationPosition(
        paths,
        occupied,
        29,
        undefined,
        undefined,
        markerRadius
    )
    if (face.symbols?.length) occupied.push(symbolPosition)
    const upgradeCostPosition = annotationPosition(
        paths,
        occupied,
        31,
        undefined,
        undefined,
        markerRadius
    )
    return {
        polygon: geometry.vertices.map((point) => `${point.x},${point.y}`).join(' '),
        citySlotRadius,
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

export const DefaultCitySlotRadius = 10

// Slots sit a little apart at the default size; larger circles touch, as printed in 18xx Maker.
function stationPositions(
    count: number,
    center: Point,
    rotation: number,
    slotRadius: number
): Point[] {
    const spacing = Math.max(DefaultCitySlotRadius + 1, slotRadius)
    return Array.from({ length: count }, (_, index) => {
        if (count === 1) return center
        const radius = count === 2 ? spacing : spacing / Math.sin(Math.PI / count)
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
const LabelOutline = 1.25
const MarkerRadius = 10
const LabelTrackClearance = 3.5
const RevenueBadgeRadius = 8.7
const LabelTrackCasing = 4.6

function labelAnnotationPosition(
    paths: readonly TileDrawnPath[],
    occupied: readonly Point[],
    vertices: readonly Point[],
    label: string,
    fontSize: number,
    markerRadius: number
): Point {
    const halfWidth = (label.length * 0.7 * fontSize) / 2 + LabelOutline
    // Labels are capitals and figures, so the cap height bounds the glyphs.
    const halfHeight = (fontSize * 0.75) / 2 + LabelOutline
    const track = paths.flatMap((path) =>
        Array.from({ length: 21 }, (_, index) => tilePathPoint(path, index / 20))
    )
    const boxDistance = (point: Point, center: Point) =>
        Math.hypot(
            Math.max(0, Math.abs(point.x - center.x) - halfWidth),
            Math.max(0, Math.abs(point.y - center.y) - halfHeight)
        )
    const fits = (center: Point) =>
        occupied.every((marker) => boxDistance(marker, center) >= markerRadius) &&
        [-1, 1].every((horizontal) =>
            [-1, 1].every((vertical) =>
                insideHex(vertices, {
                    x: center.x + horizontal * halfWidth,
                    y: center.y + vertical * halfHeight
                })
            )
        )
    const clear = (center: Point) =>
        fits(center) && track.every((point) => boxDistance(point, center) >= LabelTrackClearance)
    const preferred = 31.5
    const radii = Array.from({ length: 9 }, (_, step) => preferred - step * 2).flatMap(
        (radius, step) => (step ? [radius, preferred + step * 2] : [radius])
    )
    const onRing = (accept: (center: Point) => boolean) => {
        for (const radius of radii) {
            const position = annotationPosition(
                paths,
                occupied,
                radius,
                undefined,
                accept,
                markerRadius,
                24
            )
            if (accept(position)) return position
        }
        return undefined
    }
    // The most open clear spot anywhere, for a label too large for the preferred ring.
    const openest = () => {
        const room = (center: Point) =>
            Math.min(
                ...occupied.map((marker) => boxDistance(marker, center) - markerRadius),
                ...track.map((point) => boxDistance(point, center) - LabelTrackClearance)
            )
        let best: { center: Point; room: number } | undefined
        for (let x = -45; x <= 45; x += 1.5)
            for (let y = -45; y <= 45; y += 1.5) {
                const center = { x, y }
                if (!clear(center)) continue
                const space = room(center)
                if (!best || space > best.room) best = { center, room: space }
            }
        return best?.center
    }
    // Centred in the free run between whatever is behind it and its nearest corner.
    const settle = (center: Point, accept: (center: Point) => boolean) => {
        const corner = vertices.reduce((best, vertex) =>
            Math.hypot(vertex.x - center.x, vertex.y - center.y) <
            Math.hypot(best.x - center.x, best.y - center.y)
                ? vertex
                : best
        )
        const span = Math.hypot(corner.x - center.x, corner.y - center.y)
        const direction = { x: (corner.x - center.x) / span, y: (corner.y - center.y) / span }
        const at = (step: number) => ({
            x: center.x + direction.x * step,
            y: center.y + direction.y * step
        })
        // Measured to the drawn city band and track casing where the label clears them.
        const seen = (point: Point) =>
            fits(point) &&
            occupied.every((marker) => boxDistance(marker, point) >= markerRadius + 1.5) &&
            track.every((sample) => boxDistance(sample, point) >= LabelTrackCasing)
        const steps = Array.from({ length: 161 }, (_, index) => index * 0.25 - 20)
        const runs = (room: (point: Point) => boolean) =>
            steps.reduce<number[][]>((found, step) => {
                if (!room(at(step))) return found
                const last = found.at(-1)
                if (last && step - last[last.length - 1] < 0.3) last.push(step)
                else found.push([step])
                return found
            }, [])
        const gap = (run: number[]) => Math.min(...run.map((step) => Math.abs(step)))
        const nearest = (found: number[][]) =>
            found.reduce<number[] | undefined>(
                (best, run) => (!best || gap(run) < gap(best) ? run : best),
                undefined
            )
        const run = nearest(runs(seen)) ?? nearest(runs(accept))
        if (!run) return center
        const inward = run[0]
        const outward = run[run.length - 1]
        return at((inward + outward) / 2)
    }
    const ring = onRing(clear)
    if (ring) return settle(ring, clear)
    const open = openest()
    if (open) return settle(open, clear)
    const fitting = onRing(fits)
    if (fitting) return settle(fitting, fits)
    return annotationPosition(paths, occupied, preferred, undefined, undefined, markerRadius)
}

function insideHex(vertices: readonly Point[], point: Point): boolean {
    return vertices.every((a, index) => {
        const b = vertices[(index + 1) % vertices.length]
        return (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x) >= 0
    })
}

// A corner revenue slides further into its corner until it clears every station circle.
function clearOfStations(
    position: Point,
    slots: readonly Point[],
    slotRadius: number,
    vertices: readonly Point[]
): Point {
    const reach = Math.hypot(position.x, position.y)
    if (!reach) return position
    const direction = { x: position.x / reach, y: position.y / reach }
    const clear = (point: Point) =>
        slots.every(
            (slot) =>
                Math.hypot(point.x - slot.x, point.y - slot.y) >=
                slotRadius + RevenueBadgeRadius + 1
        )
    let point = position
    for (let step = 0.25; !clear(point) && step <= 12; step += 0.25) {
        const next = { x: position.x + direction.x * step, y: position.y + direction.y * step }
        if (edgeDistance(vertices, next) < RevenueBadgeRadius + 1) break
        point = next
    }
    return point
}

function edgeDistance(vertices: readonly Point[], point: Point): number {
    return Math.min(
        ...vertices.map((a, index) => {
            const b = vertices[(index + 1) % vertices.length]
            return (
                Math.abs((b.x - a.x) * (a.y - point.y) - (a.x - point.x) * (b.y - a.y)) /
                Math.hypot(b.x - a.x, b.y - a.y)
            )
        })
    )
}

function annotationPosition(
    paths: readonly TileDrawnPath[],
    occupied: readonly Point[],
    radius: number,
    corners?: readonly Point[],
    fits: (point: Point) => boolean = () => true,
    markerRadius = MarkerRadius,
    directions = 12
): Point {
    const samples = paths.flatMap((path) =>
        Array.from({ length: 21 }, (_, index) => tilePathPoint(path, index / 20))
    )
    const candidates = corners
        ? corners.map((point) => ({ x: (point.x * radius) / 50, y: (point.y * radius) / 50 }))
        : Array.from({ length: directions }, (_, index) => {
              const angle = (((index * 360) / directions - 90) * Math.PI) / 180
              return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) }
          })
    function clearance(point: Point): number {
        return Math.min(
            ...samples.map((sample) => Math.hypot(point.x - sample.x, point.y - sample.y)),
            ...occupied.map(
                (sample) => Math.hypot(point.x - sample.x, point.y - sample.y) - markerRadius
            )
        )
    }
    const fitting = candidates.filter(fits)
    return (fitting.length ? fitting : candidates).reduce((best, point) =>
        clearance(point) > clearance(best) ? point : best
    )
}
