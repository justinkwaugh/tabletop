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
    tileEdgeLane,
    type TileEdge,
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
    trackCrossings,
    type TileDrawnPath,
    type TrackCrossing,
    type TrackSpike
} from './tileTrackGeometry.js'
import { stagedRevenueLayout, type RevenueCell } from './stagedRevenueLayout.js'

export type { TileDrawnPath } from './tileTrackGeometry.js'

/** Corner radius of every tile and map hex, in the units tiles are drawn in about their centre. */
export const TileRadius = 50
/** How far each side's middle stands from the hex's: half the way to a neighbouring hex's middle. */
export const TileApothem = (TileRadius * Math.sqrt(3)) / 2

const OffboardSpikeReach = 0.6
const PierReach = 0.6
/** How far apart the parallel tracks crossing one hex side are drawn, centre to centre. */
export const TrackLaneGap = 13

export type TileLayout = {
    annotationExclusions?: readonly Point[]
    nodePositions?: Readonly<Record<string, Point>>
    townTrackPositions?: Readonly<Record<string, number>>
    pathControls?: Readonly<Record<string, readonly [Point, Point]>>
    revenuePositions?: Readonly<Record<string, Point>>
    revenuePositionsByRotation?: Partial<Record<TileRotation, Readonly<Record<string, Point>>>>
    revenuePositionsByOrientation?: Partial<Record<HexOrientation, Readonly<Record<string, Point>>>>
    labelPosition?: Point
    /** The label's colour in place of ink, drawn without a halo, as on a dark city it stands on. */
    labelColor?: string
    /** A label position by the tile's rotation, for a label that stays put as the tile turns. */
    labelPositionByRotation?: Partial<Record<TileRotation, Point>>
    /** Where the cost of upgrading the tile is printed, in place of the clearest spot found. */
    upgradeCostPosition?: Point
    /**
     * Prints the cost of upgrading the tile as bare text, without its box, after any prefix such
     * as a currency's sign, as 1822's London prints £20.
     */
    upgradeCostText?: { prefix?: string }
    /**
     * Degrees clockwise to turn a city's row of station spaces off the tile's own axis, by node
     * id, such as to level a two-space city under a row of revenues.
     */
    slotRowTurns?: Readonly<Record<string, number>>
    /**
     * Degrees to swing a four-space city's lower spaces out from under its upper ones, by node id,
     * opening the square into an upside-down V toward the two hexes below.
     */
    slotSpreads?: Readonly<Record<string, number>>
    /**
     * How far each of a two-space city's spaces stands from its middle, by node id, where the
     * print sets them closer than touching, as 1822 overlaps the Metropolitan Railway's space on
     * the London station it stands beside.
     */
    slotSpacing?: Readonly<Record<string, number>>
    /**
     * Prints the whole hex in its ink rather than the tile's colour, with its label, its
     * upgrade's cost and any printed text in the paper's colour, as 1822's board prints London.
     */
    inkGround?: true
    /** Text the print sets on the tile, such as a city's name that every upgrade repeats. */
    printedText?: readonly TilePrintedText[]
    /**
     * Shapes the print fills with its ink past the hex's sides into the hexes beside it, drawn
     * on a map over whatever lies there, as the spikes from 1822's London toward its neighbours.
     */
    overhangs?: readonly (readonly Point[])[]
    /**
     * Filled shapes the print sets on the tile under its track, before the tile's rotation, as
     * 1867's yellow triangles mark a side its yellow tile must connect to (GTG §8.6.2).
     */
    printedShapes?: readonly TilePrintedShape[]
    hideRevenue?: true | readonly string[]
    /** Lays staged revenue boxes out in a column or a row rather than whichever fits best. */
    revenueStack?: 'column' | 'row'
    /** Centres the revenue, with any badge beneath it on a map, on the hex's middle line. */
    revenueAlign?: 'middle'
    /**
     * How the print draws a connection to the board's edge, by path id: a spike, which a track
     * from side to side draws at its first side pointing in toward the hex's middle; a port's
     * dashes from the edge to an anchor; or
     * nothing, where the print shows the connection another way.
     */
    printedPaths?: Readonly<Record<string, 'spike' | 'pier' | 'hidden'>>
    /**
     * Tokens the tile prints, such as a reservation in a city's space or a private's mark on
     * its track: in a station space by node and slot, or at a point before the tile's rotation.
     */
    printedTokens?: readonly TilePrintedToken[]
    /**
     * Track the print shows beside the face's own, which no route uses, straight between two
     * points of the tile before its rotation. 1822 prints its one Merthyr Tydfil–Pontypool
     * connection as two straight pointed tracks, one from each city into the other's hex (§5.4.7).
     */
    printedTrack?: readonly TilePrintedTrack[]
    /** Prints a staged location's captions above its values, in a row. */
    revenueCaptionsAbove?: boolean
    /** Prints staged values' phase captions after them, as on a board's east edge. */
    revenueCaptionsAfter?: boolean
    /** How far an offboard spike runs from its edge toward its stop, as a share of the way. */
    spikeReach?: number
    /**
     * Points every spike straight in from its side toward the hex's middle rather than at its
     * stop, where the stop stands off to one side, as the Highlands' station across its two hexes.
     */
    spikesTowardMiddle?: true
    /**
     * Sides, before the tile's rotation, whose parallel tracks are drawn in the other order, so
     * that tracks running side by side through a hex do not cross. The hex across each such side
     * flips its own matching side, since a lane meets the same lane there.
     */
    flippedLaneEdges?: readonly TileEdge[]
}

/** A filled shape a layout prints; see ``TileLayout.printedShapes``. */
export type TilePrintedShape = { points: readonly Point[]; color: string }
/** A printed shape as drawn: its polygon points, each pair "x,y", and its colour. */
export type TileDrawnShape = { points: string; color: string }
/** Text a layout prints on the tile; see ``TileLayout.printedText``. */
export type TilePrintedText = { content: string; at: Point; fontSize: number }
/** Track a layout prints that no route uses; see ``TileLayout.printedTrack``. */
export type TilePrintedTrack = {
    id: string
    from: Point
    to: Point
    /** Drawn as a spike, full width at ``from`` and coming to a point at ``to``. */
    spike?: true
}
export type TilePrintedToken = {
    imageUrl: string
    title: string
} & ({ nodeId: string; slot: number } | { at: Point; radius: number })
/** A printed token placed on the drawn tile, with a station space's size where it fills one. */
export type TileDrawnToken = {
    imageUrl: string
    title: string
    center: Point
    radius: number
    space: boolean
}

export type TileDrawnNode = {
    node: TileNode
    center: Point
    unmarked?: true
    slots: readonly Point[]
    /** Spaces opened into an upside-down V, whose band leaves its bottom side open. */
    openBand?: true
    revenuePosition: Point
    revenueCells: readonly RevenueCell[]
    revenueHidden: boolean
    /** Station circle radius: the style's size, reduced so neighbouring cities on the tile stay apart. */
    slotRadius: number
    townAngle?: number
    /**
     * Radius of a node drawn as a dot: a town's is larger where three or more tracks meet, and a
     * city without station spaces fills a station circle, since it is still a city.
     */
    dotRadius: number
}

/** The tile style's measurements that geometry and annotation placement depend on. */
export type TileDrawingStyle = {
    citySlotRadius?: number
    labelFontSize?: number
    longLabelFontSize?: number
    /** Printed prefixes for revenue stages that are not phases, such as D for diesel. */
    revenueStageLabels?: Readonly<Record<string, string>>
    /** Phases printed beside each revenue stage's value, such as I-II. */
    revenueStageCaptions?: Readonly<Record<string, string>>
    revenueStageCaptionColors?: Readonly<Record<string, string>>
    /** How staged values line up where a location's layout does not say. */
    revenueStack?: 'column' | 'row'
    /** Curves a lone one-station city's name over the top of the city. */
    cityNameArcs?: boolean
    /** Draws every town as a dot, never a bar across its track. */
    townDots?: boolean
}

export type TileDrawing = {
    polygon: string
    /** Station circle radius the slots are spaced for. */
    citySlotRadius: number
    paths: readonly TileDrawnPath[]
    crossings: readonly TrackCrossing[]
    nodes: readonly TileDrawnNode[]
    labelPosition: Point
    /** The label's colour, where its layout gives one. */
    labelColor?: string
    symbolPosition: Point
    upgradeCostPosition: Point
    printedTokens: readonly TileDrawnToken[]
    inkGround: boolean
    upgradeCostText?: { prefix: string }
    printedText: readonly TilePrintedText[]
    /** Polygon points, each pair "x,y", of the shapes reaching past the hex's sides. */
    overhangs: readonly string[]
    printedShapes: readonly TileDrawnShape[]
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
        { orientation, dimensions: { radius: TileRadius } },
        { q: 0, r: 0 }
    )
    const angle =
        ((rotation * 60 + (orientation === HexOrientation.Pointy ? 30 : 0)) * Math.PI) / 180
    // Four slots form a square, which a hex turn would tilt, so it stays upright, filled from
    // the top left.
    const citySlots = (node: Extract<TileNode, { kind: 'city' }>, center: Point) => {
        const slots = stationPositions(
            node.stationSlots,
            center,
            (node.stationSlots === 4 ? -Math.PI / 4 : angle) +
                ((layout.slotRowTurns?.[node.id] ?? 0) * Math.PI) / 180,
            citySlotRadius,
            node.stationSlots === 2 ? layout.slotSpacing?.[node.id] : undefined
        )
        const spread = layout.slotSpreads?.[node.id]
        return spread === undefined || slots.length !== 4 ? slots : spreadSquare(slots, spread)
    }
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

    // The parallel tracks each side carries: one unless some track names a further lane there.
    const laneCounts = new Map<TileEdge, number>()
    for (const endpoint of face.paths.flatMap((path) => path.endpoints))
        if (endpoint.kind === 'edge')
            laneCounts.set(
                endpoint.edge,
                Math.max(laneCounts.get(endpoint.edge) ?? 1, tileEdgeLane(endpoint) + 1)
            )
    const laned = (path: TilePath) =>
        path.endpoints.some(
            (endpoint) => endpoint.kind === 'edge' && (laneCounts.get(endpoint.edge) ?? 1) > 1
        )
    function sideMiddle(edge: TileEdge): { middle: Point; along: Point } {
        const index =
            orientation === HexOrientation.Flat
                ? ClockwiseFlatHexDirections.indexOf(tileEdgeDirection(edge, orientation))
                : ClockwisePointyHexDirections.indexOf(tileEdgeDirection(edge, orientation))
        const a = geometry.vertices[index]
        const b = geometry.vertices[(index + 1) % 6]
        const length = Math.hypot(b.x - a.x, b.y - a.y)
        return {
            middle: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
            along: { x: (b.x - a.x) / length, y: (b.y - a.y) / length }
        }
    }

    function endpointPosition(endpoint: TileEndpoint): Point {
        if (endpoint.kind === 'node') {
            const center = centers.get(endpoint.nodeId)
            assertExists(center, `Unknown tile node ${endpoint.nodeId}`)
            return center
        }
        const edge = rotateTileEdge(endpoint.edge, rotation)
        const { middle, along } = sideMiddle(edge)
        const lanes = laneCounts.get(endpoint.edge) ?? 1
        if (lanes === 1) return middle
        // Opposite sides run opposite ways round the hex, so each side of a border orders its
        // lanes the other way and a lane meets itself across it.
        const order =
            (edge < 3 ? -1 : 1) * (layout.flippedLaneEdges?.includes(endpoint.edge) ? -1 : 1)
        const offset = order * (tileEdgeLane(endpoint) - (lanes - 1) / 2) * TrackLaneGap
        return { x: middle.x + along.x * offset, y: middle.y + along.y * offset }
    }
    /** A control point straight in from a side, for track that leaves it at a right angle. */
    function squareControl(endpoint: TileEndpoint, point: Point, distance: number): Point {
        if (endpoint.kind !== 'edge') return point
        const { middle } = sideMiddle(rotateTileEdge(endpoint.edge, rotation))
        const length = Math.hypot(middle.x, middle.y)
        return {
            x: point.x - (middle.x / length) * distance,
            y: point.y - (middle.y / length) * distance
        }
    }

    function plainPath(path: TilePath, start: Point, end: Point): TileDrawnPath {
        const hint = layout.pathControls?.[path.id]
        if (!hint && laned(path)) {
            const reach = Math.hypot(end.x - start.x, end.y - start.y) * 0.45
            return createCubicTilePath(path.id, start, end, [
                squareControl(path.endpoints[0], start, reach),
                squareControl(path.endpoints[1], end, reach)
            ])
        }
        if (!hint && path.endpoints.every((endpoint) => endpoint.kind === 'edge'))
            return createEdgeTilePath(path.id, start, end)
        const handleLength = Math.hypot(end.x - start.x, end.y - start.y) * 0.45
        const controls: readonly [Point, Point] = hint
            ? [orientPoint(hint[0], angle), orientPoint(hint[1], angle)]
            : [
                  path.endpoints[0].kind === 'edge' ? inwardControl(start, handleLength) : start,
                  path.endpoints[1].kind === 'edge' ? inwardControl(end, handleLength) : end
              ]
        return createCubicTilePath(path.id, start, end, controls)
    }
    const townLine = (incident: readonly TilePath[]) => {
        const edges = incident.map((path) =>
            path.endpoints.find((endpoint) => endpoint.kind === 'edge')
        )
        assertExists(edges[0], 'A town on through track reaches a hex side')
        assertExists(edges[1], 'A town on through track reaches a hex side')
        const a = endpointPosition(edges[0])
        const b = endpointPosition(edges[1])
        return { a, b, curve: createEdgeTilePath('line', a, b) }
    }
    const otherTrack = (nodeId: string): TileDrawnPath[] => [
        ...[...automaticTownPaths]
            .filter(([other]) => other !== nodeId)
            .map(([, incident]) => townLine(incident).curve),
        ...face.paths.flatMap((path) => {
            if ([...automaticTownPaths.values()].some((incident) => incident.includes(path)))
                return []
            const known = path.endpoints.every(
                (endpoint) => endpoint.kind === 'edge' || centers.has(endpoint.nodeId)
            )
            return known
                ? [
                      plainPath(
                          path,
                          endpointPosition(path.endpoints[0]),
                          endpointPosition(path.endpoints[1])
                      )
                  ]
                : []
        })
    ]
    const townPaths = new Map<string, TileDrawnPath>()
    for (const [nodeId, incident] of automaticTownPaths) {
        const { a, b, curve } = townLine(incident)
        const middle = tilePathPoint(
            curve,
            layout.townTrackPositions?.[nodeId] ?? clearPosition(curve, otherTrack(nodeId))
        )
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
        const printed = layout.printedPaths?.[path.id]
        if (!offboard && !printed) return drawn
        if (printed === 'hidden') return { ...drawn, hidden: true }
        return printed === 'pier'
            ? { ...drawn, pier: towardStop(path, drawn, PierReach) }
            : { ...drawn, spike: towardStop(path, drawn, layout.spikeReach ?? OffboardSpikeReach) }
    }
    /** A spike or pier from a track's side, reaching that share of the way to its other end. */
    const towardStop = (path: TilePath, drawn: TileDrawnPath, reach: number): TrackSpike => {
        const [base, stop] =
            path.endpoints[0].kind === 'edge' ? [drawn.start, drawn.end] : [drawn.end, drawn.start]
        // A track between two sides has no stop, so its spike points in toward the hex's middle.
        const center =
            layout.spikesTowardMiddle ||
            path.endpoints.every((endpoint) => endpoint.kind === 'edge')
                ? { x: 0, y: 0 }
                : stop
        return {
            base,
            tip: {
                x: base.x + (center.x - base.x) * reach,
                y: base.y + (center.y - base.y) * reach
            }
        }
    }
    const drawnPath = (path: TilePath): TileDrawnPath => {
        const townPath = townPaths.get(path.id)
        if (townPath) return townPath
        const start = endpointPosition(path.endpoints[0])
        const end = endpointPosition(path.endpoints[1])
        const drawn = plainPath(path, start, end)
        return path.endpoints.every((endpoint) => endpoint.kind === 'edge') &&
            !layout.pathControls?.[path.id] &&
            !layout.printedPaths?.[path.id]
            ? drawn
            : withOffboardSpike(path, drawn)
    }
    const facePaths = face.paths.map((path): TileDrawnPath => {
        const drawn = drawnPath(path)
        return path.gauge ? { ...drawn, gauge: path.gauge } : drawn
    })
    // Track the print shows that no route uses, drawn straight after the face's own.
    const printedTrackPaths = (layout.printedTrack ?? []).map(({ id, from, to, spike }) => {
        const drawn = createStraightTilePath(id, orientPoint(from, angle), orientPoint(to, angle))
        return spike ? { ...drawn, spike: { base: drawn.start, tip: drawn.end } } : drawn
    })
    const paths = [...facePaths, ...printedTrackPaths]

    const stationSlots = face.nodes.flatMap((node) => {
        const center = centers.get(node.id)
        return center && node.kind === 'city' && node.stationSlots > 0
            ? citySlots(node, center)
            : []
    })
    const occupied: Point[] = [
        ...(layout.annotationExclusions ?? []),
        ...face.nodes.flatMap((node) => {
            const center = centers.get(node.id)
            assertExists(center, `Unknown tile node ${node.id}`)
            return node.kind === 'city' && node.stationSlots > 0
                ? citySlots(node, center)
                : [center]
        })
    ]
    const labelHint = layout.labelPositionByRotation?.[rotation] ?? layout.labelPosition
    if (face.labels.length > 0 && labelHint) {
        occupied.push(orientPoint(labelHint, angle))
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
                      {
                          stageLabels: style.revenueStageLabels,
                          captions: style.revenueStageCaptions,
                          captionColors: style.revenueStageCaptionColors,
                          captionAfter: layout.revenueCaptionsAfter,
                          captionAbove: layout.revenueCaptionsAbove,
                          stack: layout.revenueStack ?? style.revenueStack,
                          fixed: !!hint
                      }
                  )
        if (node.kind !== 'junction' && !revenueHidden)
            occupied.push(...(revenueCells.length ? revenueCells : [revenuePosition]))
        const nodeTracks = face.paths.filter((path) =>
            path.endpoints.some(
                (endpoint) => endpoint.kind === 'node' && endpoint.nodeId === node.id
            )
        )
        const tracks = nodeTracks.length
        const unmarked =
            (node.kind === 'town' || node.kind === 'junction') &&
            tracks > 0 &&
            nodeTracks.every((path) => {
                const drawn = paths.find((entry) => entry.id === path.id)
                return !!(drawn?.spike || drawn?.pier)
            })
        // A town on through track, or ending a single track, is a bar across that track.
        const townAngle =
            !style.townDots &&
            !unmarked &&
            node.kind === 'town' &&
            (automaticTownPaths.has(node.id) || tracks === 1)
                ? townMarkerAngle(center, paths)
                : undefined
        const dotRadius = townAngle !== undefined ? 4.2 : tracks >= 3 && !unmarked ? 9 : 6.3
        return {
            node,
            center,
            ...(unmarked ? { unmarked: true as const } : {}),
            slots: node.kind === 'city' ? citySlots(node, center) : [],
            ...(node.kind === 'city' && layout.slotSpreads?.[node.id] !== undefined
                ? { openBand: true as const }
                : {}),
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
        const slotRadius = Math.min(citySlotRadius, nearest / 2 - 0.75)
        return {
            ...drawn,
            slotRadius,
            dotRadius:
                drawn.node.kind === 'city' && !drawn.slots.length ? slotRadius : drawn.dotRadius
        }
    })
    const labelPosition = labelHint
        ? orientPoint(labelHint, angle)
        : labelAnnotationPosition(
              paths,
              occupied,
              geometry.vertices,
              face.labels.join(' '),
              labelFontSize(
                  face.labels.join(' '),
                  style.labelFontSize ?? LabelFontSize,
                  style.longLabelFontSize
              ),
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
    const upgradeCostPosition = layout.upgradeCostPosition
        ? orientPoint(layout.upgradeCostPosition, angle)
        : annotationPosition(paths, occupied, 31, undefined, undefined, markerRadius)
    return {
        polygon: geometry.vertices.map((point) => `${point.x},${point.y}`).join(' '),
        citySlotRadius,
        paths,
        crossings: trackCrossings(paths),
        nodes,
        labelPosition,
        ...(layout.labelColor ? { labelColor: layout.labelColor } : {}),
        symbolPosition,
        upgradeCostPosition,
        inkGround: !!layout.inkGround,
        ...(layout.upgradeCostText
            ? { upgradeCostText: { prefix: layout.upgradeCostText.prefix ?? '' } }
            : {}),
        printedText: (layout.printedText ?? []).map((text) => ({
            ...text,
            at: orientPoint(text.at, angle)
        })),
        printedShapes: (layout.printedShapes ?? []).map(({ points, color }) => ({
            points: points
                .map((point) => orientPoint(point, angle))
                .map((point) => `${point.x},${point.y}`)
                .join(' '),
            color
        })),
        overhangs: (layout.overhangs ?? []).map((points) =>
            points
                .map((point) => orientPoint(point, angle))
                .map((point) => `${point.x},${point.y}`)
                .join(' ')
        ),
        printedTokens: (layout.printedTokens ?? []).flatMap((token): TileDrawnToken[] => {
            if ('at' in token)
                return [
                    {
                        imageUrl: token.imageUrl,
                        title: token.title,
                        center: orientPoint(token.at, angle),
                        radius: token.radius,
                        space: false
                    }
                ]
            const node = nodes.find((entry) => entry.node.id === token.nodeId)
            const center = node?.slots[token.slot]
            return node && center
                ? [
                      {
                          imageUrl: token.imageUrl,
                          title: token.title,
                          center,
                          radius: node.slotRadius,
                          space: true
                      }
                  ]
                : []
        })
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
    slotRadius: number,
    spacing = Math.max(DefaultCitySlotRadius + 1, slotRadius)
): Point[] {
    return Array.from({ length: count }, (_, index) => {
        if (count === 1) return center
        const radius = count === 2 ? spacing : spacing / Math.sin(Math.PI / count)
        const angle =
            rotation + (count === 2 ? index * Math.PI : (index * Math.PI * 2) / count - Math.PI / 2)
        return { x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius }
    })
}

/** A square of spaces, upper left first and clockwise, with its lower two swung outward. */
function spreadSquare(
    [upperLeft, upperRight, lowerRight, lowerLeft]: readonly Point[],
    degrees: number
): Point[] {
    const turn = (degrees * Math.PI) / 180
    const swing = (upper: Point, lower: Point, side: number) => {
        const length = Math.hypot(lower.x - upper.x, lower.y - upper.y)
        return {
            x: upper.x + side * Math.sin(turn) * length,
            y: upper.y + Math.cos(turn) * length
        }
    }
    return [
        upperLeft,
        upperRight,
        swing(upperRight, lowerRight, 1),
        swing(upperLeft, lowerLeft, -1)
    ]
}

/** Other track this near a town's middle runs through its marker, so the town moves along its line. */
const TownTrackOverlap = 12
/** How far a moved town keeps from other track, about its marker's length. */
const TownTrackClearance = 18

/**
 * Where along its line a town stands: the middle unless other track runs through it there, else
 * the nearest point to the middle that clears other track, or failing that the clearest point.
 */
function clearPosition(line: TileDrawnPath, others: readonly TileDrawnPath[]): number {
    if (!others.length) return 0.5
    const samples = others.flatMap((other) =>
        Array.from({ length: 33 }, (_, index) => tilePathPoint(other, index / 32))
    )
    const clearance = (t: number) => {
        const point = tilePathPoint(line, t)
        return Math.min(
            ...samples.map((sample) => Math.hypot(sample.x - point.x, sample.y - point.y))
        )
    }
    if (clearance(0.5) >= TownTrackOverlap) return 0.5
    const candidates = Array.from(
        { length: 36 },
        (_, step) => 0.5 + (step % 2 ? 1 : -1) * Math.ceil(step / 2) * 0.02
    )
    return (
        candidates.find((t) => clearance(t) >= TownTrackClearance) ??
        candidates.reduce((best, t) => (clearance(t) > clearance(best) ? t : best))
    )
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

export const LabelFontSize = 12
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

/** The size a label is printed at: labels of three or more characters, such as Chi, use ``longSize``. */
export function labelFontSize(text: string, size: number, longSize?: number): number {
    return text.length > 2 ? (longSize ?? size) : size
}
