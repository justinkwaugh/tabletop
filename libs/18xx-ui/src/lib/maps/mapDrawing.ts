import type { MapViewDefinition, StationAppearance, SymbolPosition } from './stationPresentation.js'
import {
    assert,
    assertExists,
    calculateHexGeometry,
    ClockwiseFlatHexDirections,
    ClockwisePointyHexDirections,
    HexOrientation,
    type AxialCoordinates,
    type BoundingBox,
    type Point
} from '@tabletop/common'
import {
    TileEdges,
    tileEdgeDirection,
    rotateTileEdge,
    rotateTileFace,
    RailwayMapState,
    type RoutePath,
    type StationPosition,
    type StationReservation,
    type RailwayMap,
    type MapLocation,
    type TileEdge,
    type TileFace,
    type TileRotation,
    type TileSet,
    type TileInventory,
    type LocationMarker
} from '@tabletop/18xx'
import {
    createTileDrawing,
    DefaultCitySlotRadius,
    type TileDrawing,
    type TileDrawnPath
} from '../tiles/tileDrawing.js'
import { StandardTileLayouts } from '../tiles/standardTileLayouts.js'
import type { TileSymbolName } from '../tiles/tileSymbols.js'
import { tilePathPoint } from '../tiles/tileTrackGeometry.js'

export type MapSelection =
    | { kind: 'hex'; locationId: string }
    | { kind: 'path'; locationId: string; pathId: string }
    | { kind: 'node'; locationId: string; nodeId: string }
    | { kind: 'slot'; locationId: string; nodeId: string; slot: number }

export type MapToken = StationPosition & StationAppearance & { id: string }
export type MapRoute = {
    id: string
    color: string
    segments: readonly RoutePath[]
}
export function routeLocationIds(routes: readonly MapRoute[]): string[] {
    return [...new Set(routes.flatMap((route) => route.segments.map((path) => path.locationId)))]
}
/**
 * A presentation-only relocation of an untiled hex, for boards whose print rearranges cells.
 * ``at`` moves the hex to another grid cell; ``edges`` remaps the preprinted track's edges to the
 * printed ones (same path ids, so routes still resolve); ``hidden`` draws nothing for the hex.
 */
export type MapPlacement = {
    at?: AxialCoordinates
    edges?: Readonly<Record<number, number>>
    hidden?: boolean
}

export type MapMarkerArt =
    | { imageUrl: string }
    | { tileSymbol: TileSymbolName }
    /** Not drawn, where the location's name or artwork already says it. */
    | { hidden: true }
    /** Two linked circles after the marker's label, below the hex's centre or ``above`` it. */
    | { localLine: true; above?: true }
    /** The marker's label, large in the centre of an unbuilt hex. */
    | { centeredLabel: true }
    /**
     * The marker's label as a badge beneath the hex's revenue, such as a route bonus; arrows
     * point the badge both ways, as for an east–west bonus.
     */
    | { revenueBadge: true; arrows?: true }
    /** The marker's symbol, once per count, at revenue size beneath the hex's revenue. */
    | { revenueSymbol: TileSymbolName }
    /**
     * A marker placed during play: the hex is outlined in the colour, with a badge on its top
     * corner showing the owning company's token and the marker's icon.
     */
    | {
          placed: {
              color: string
              companyId: string
              icon: { tileSymbol: TileSymbolName } | { imageUrl: string }
          }
      }

export type RevenueAnnotation = { markerId: string; label: string; x: number; y: number } & (
    | { kind: 'badge'; width: number; height: number; arrows: boolean }
    | { kind: 'symbol'; symbol: TileSymbolName; radius: number }
)
type RevenueBadge = Extract<RevenueAnnotation, { kind: 'badge' }>
const RevenueRadius = 8.7
// Between a station circle and the baseline of the name curved over it.
const NameArcGap = 2.2
const NameArcCapHeight = 4.6
const TrackHalfWidth = 4.6
// A revenue with a badge beneath it rises to leave a gap between them.
const BadgeLift = 3

export type MapDrawnLocation = {
    location: MapLocation
    center: Point
    face: TileFace
    rotation: TileRotation
    placed: boolean
    /** True for a presentation placement that hides the hex entirely. */
    hidden: boolean
    markerArt: Readonly<Record<string, MapMarkerArt>>
    drawing: TileDrawing
    borders: readonly {
        start: Point
        end: Point
        border: NonNullable<MapLocation['borders']>[number]
    }[]
    outline: readonly HexSegment[]
    /** Edges shared with hexes printed as the same area. */
    joints: readonly HexSegment[]
    /** Edges between two different offboard areas. */
    divisions: readonly HexSegment[]
    revenueAnnotations: readonly RevenueAnnotation[]
    nameShown: boolean
    /** Baseline of the name's first line. */
    nameBaseline: Point
    /** The name's lines where it prints straight. */
    nameRows: readonly string[]
    /**
     * True where the title places a city or town's name itself rather than across the top. An
     * offboard's name is never curved, so it keeps the plain style wherever it is placed.
     */
    namePlaced: boolean
    /**
     * The circle a lone city's name follows, where the style curves names: centred over the top,
     * or under the foot when ``below``, turned ``rotation`` degrees clockwise off any track and
     * spanning ``span`` radians. ``radius`` is the text's baseline.
     */
    nameArc?: { center: Point; radius: number; rotation: number; span: number; below: boolean }
    /** Height of the printed terrain cost row: centred below the hex's stops, or mid-hex. */
    terrainY: number
}
type HexSegment = { start: Point; end: Point }
export type BoardArtwork = {
    backgroundColor?: string
    imageUrl: string
    width: number
    height: number
    origin: Point
    scale: number
}

export function mapViewport(
    scene: MapDrawing,
    hexDiameter: number,
    artwork?: BoardArtwork,
    extents: readonly BoundingBox[] = []
) {
    const scale = artwork?.scale ?? hexDiameter / 100
    const bounds = artwork
        ? {
              x: -artwork.origin.x / scale,
              y: -artwork.origin.y / scale,
              width: artwork.width / scale,
              height: artwork.height / scale
          }
        : extents.reduce(enclosingBounds, scene.bounds)
    return { bounds, scale, width: bounds.width * scale, height: bounds.height * scale }
}

export type MapViewport = ReturnType<typeof mapViewport>

export function viewportRect(viewport: MapViewport, rect: BoundingBox): BoundingBox {
    return {
        x: (rect.x - viewport.bounds.x) * viewport.scale,
        y: (rect.y - viewport.bounds.y) * viewport.scale,
        width: rect.width * viewport.scale,
        height: rect.height * viewport.scale
    }
}

function enclosingBounds(first: BoundingBox, second: BoundingBox): BoundingBox {
    const x = Math.min(first.x, second.x)
    const y = Math.min(first.y, second.y)
    return {
        x,
        y,
        width: Math.max(first.x + first.width, second.x + second.width) - x,
        height: Math.max(first.y + first.height, second.y + second.height) - y
    }
}

export type MapDrawing = {
    map: RailwayMap
    locations: readonly MapDrawnLocation[]
    bounds: BoundingBox
    /** Printed before terrain costs, such as ¥. */
    terrainCostPrefix: string
}

function remapFaceEdges(face: TileFace, edges: Readonly<Record<number, number>>): TileFace {
    return {
        ...face,
        paths: face.paths.map((path) => {
            const remap = (endpoint: (typeof path.endpoints)[number]) =>
                endpoint.kind === 'edge' && edges[endpoint.edge] !== undefined
                    ? { ...endpoint, edge: edges[endpoint.edge] as typeof endpoint.edge }
                    : endpoint
            return {
                ...path,
                endpoints: [remap(path.endpoints[0]), remap(path.endpoints[1])] as const
            }
        })
    }
}

export function locationMarkerName(
    view: Pick<MapViewDefinition, 'locationMarkerNames'>,
    kind: string
): string {
    const name = view.locationMarkerNames?.[kind]
    assertExists(name, `The map view names ${kind} markers`)
    return name
}

/** How the private powers panel names placing a marker. */
export function privateMarkerLabel(
    view: Pick<MapViewDefinition, 'locationMarkerNames' | 'map'>,
    kind: string,
    locationId: string
): string {
    const location = view.map.location(locationId)
    return `${locationMarkerName(view, kind).toLowerCase()} on ${location.name ?? location.id}`
}

export function createMapDrawing(
    map: RailwayMap,
    supply?: {
        tileSet: TileSet
        inventory: TileInventory
        markers?: readonly Pick<LocationMarker, 'kind' | 'locationId'>[]
    },
    {
        layouts = {},
        markerArt = {},
        placements = {},
        joinedEdges = {},
        locationMarkerNames = {},
        hideLocationNames,
        drawingStyle,
        revenueStageLabels,
        terrainCostPrefix = '',
        namePositions = {},
        namesBelow = [],
        symbolPositions = {},
        nameLines = {},
        terrainHeights = {}
    }: Pick<
        MapViewDefinition,
        | 'layouts'
        | 'markerArt'
        | 'placements'
        | 'joinedEdges'
        | 'locationMarkerNames'
        | 'hideLocationNames'
        | 'drawingStyle'
        | 'revenueStageLabels'
        | 'terrainCostPrefix'
        | 'namePositions'
        | 'namesBelow'
        | 'symbolPositions'
        | 'nameLines'
        | 'terrainHeights'
    > = {}
): MapDrawing {
    const mapState = supply ? new RailwayMapState(map, supply.tileSet, supply.inventory) : undefined
    const placedMarkers = (locationId: string) =>
        (supply?.markers ?? [])
            .filter((marker) => marker.locationId === locationId)
            .map((marker) => {
                const name = locationMarkerName({ locationMarkerNames }, marker.kind)
                return { id: marker.kind, label: name, description: name }
            })
    const locations = map.definition.locations.map((printed): MapDrawnLocation => {
        const placed = placedMarkers(printed.id)
        const location = placed.length
            ? { ...printed, markers: [...(printed.markers ?? []), ...placed] }
            : printed
        const tile = mapState?.tile(location.id)
        const placement = tile?.placement
        const relocation = placement ? undefined : placements[location.id]
        const face = relocation?.edges
            ? remapFaceEdges(tile?.face ?? location.preprintedTile, relocation.edges)
            : (tile?.face ?? location.preprintedTile)
        const rotation = tile?.rotation ?? 0
        const layout = placement
            ? (layouts[placement.definitionId] ?? StandardTileLayouts[placement.definitionId])
            : layouts[location.id]
        const separatedTowns =
            face.nodes.length > 1 &&
            face.paths.length === 0 &&
            face.nodes.every((node) => node.kind === 'town')
        const tileLayout =
            layout ??
            (separatedTowns
                ? {
                      nodePositions: Object.fromEntries(
                          face.nodes.map((node, index) => [
                              node.id,
                              { x: (index - (face.nodes.length - 1) / 2) * 30, y: 0 }
                          ])
                      )
                  }
                : {})
        const nameShown =
            hideLocationNames !== true &&
            !hideLocationNames?.includes(location.id) &&
            !placement &&
            !!location.name
        const nameBaseline = namePositions[location.id] ?? { x: 0, y: -35 }
        const nameRows = nameLines[location.id] ?? splitName(location.name ?? '')
        const [loneNode, ...otherNodes] = face.nodes
        const nameArc =
            nameShown &&
            location.name &&
            drawingStyle?.cityNameArcs &&
            !namePositions[location.id] &&
            loneNode?.kind === 'city' &&
            loneNode.stationSlots === 1 &&
            !otherNodes.length
                ? arcAroundCity(
                      location.name,
                      (drawingStyle.citySlotRadius ?? DefaultCitySlotRadius) + NameArcGap,
                      namesBelow.includes(location.id),
                      createTileDrawing(
                          face,
                          map.definition.orientation,
                          rotation,
                          tileLayout,
                          drawingStyle
                      ).paths,
                      symbolPoints(symbolPositions[location.id])
                  )
                : undefined
        // Points along the name's outer edge, which annotations keep clear of.
        const nameArcPoints = nameArc
            ? [-1, -0.5, 0, 0.5, 1].map((share) => {
                  const angle =
                      (((nameArc.below ? 90 : -90) + nameArc.rotation) * Math.PI) / 180 +
                      (share * nameArc.span) / 2
                  const reach = nameArc.radius + (nameArc.below ? -2 : 3)
                  return { x: Math.cos(angle) * reach, y: Math.sin(angle) * reach }
              })
            : []
        const printedDrawing = createTileDrawing(
            face,
            map.definition.orientation,
            rotation,
            {
                ...tileLayout,
                annotationExclusions: [
                    ...(tileLayout.annotationExclusions ?? []),
                    ...nameArcPoints,
                    ...(nameShown && !nameArc
                        ? [-18, 0, 18].map((x) => ({
                              x: nameBaseline.x + x,
                              y: nameBaseline.y - 3
                          }))
                        : []),
                    ...(!placement && location.terrain
                        ? face.nodes.length
                            ? [
                                  { x: 0, y: 23 },
                                  { x: 0, y: 30 }
                              ]
                            : [{ x: 0, y: face.paths.length ? 23 : 4 }]
                        : []),
                    ...((location.markers ?? []).some((marker) => !markerArt[marker.id])
                        ? [{ x: 0, y: 36 }]
                        : [])
                ]
            },
            { ...drawingStyle, revenueStageLabels }
        )
        const markers = location.markers ?? []
        const lifted = markers.some((marker) => {
            const art = markerArt[marker.id]
            return art && 'revenueBadge' in art
        })
            ? liftRevenue(printedDrawing, BadgeLift)
            : printedDrawing
        const geometry = calculateHexGeometry(
            { orientation: map.definition.orientation, dimensions: { radius: 50 } },
            relocation?.at ?? location.coordinates
        )
        const segment = (edge: TileEdge): HexSegment => {
            const direction = tileEdgeDirection(edge, map.definition.orientation)
            const index =
                map.definition.orientation === HexOrientation.Flat
                    ? ClockwiseFlatHexDirections.findIndex((candidate) => candidate === direction)
                    : ClockwisePointyHexDirections.findIndex((candidate) => candidate === direction)
            const a = geometry.vertices[index],
                b = geometry.vertices[(index + 1) % 6]
            return {
                start: { x: a.x - geometry.center.x, y: a.y - geometry.center.y },
                end: { x: b.x - geometry.center.x, y: b.y - geometry.center.y }
            }
        }
        const borders = (location.borders ?? []).map((border) => ({
            border,
            ...segment(border.edge)
        }))
        const joined = joinedEdges[location.id] ?? []
        const { drawing, badges } = centreRevenue(
            lifted,
            revenueBadges(lifted, markers, markerArt),
            !placement && tileLayout.revenueAlign === 'middle'
        )
        const terrainRow =
            terrainHeights[location.id] ?? terrainY(drawing, face, map.definition.orientation)
        const hexVertices = geometry.vertices.map((point) => ({
            x: point.x - geometry.center.x,
            y: point.y - geometry.center.y
        }))
        const divides = (edge: TileEdge) =>
            isOffboard(location) && isOffboard(map.neighbor(location.id, edge))
        return {
            location,
            center: geometry.center,
            face,
            rotation,
            placed: !!placement,
            hidden: !!relocation?.hidden,
            drawing,
            markerArt,
            borders,
            outline: TileEdges.filter((edge) => !joined.includes(edge) && !divides(edge)).map(
                segment
            ),
            joints: joined.map(segment),
            nameShown,
            nameBaseline,
            nameRows,
            namePlaced:
                !!namePositions[location.id] &&
                !face.nodes.some((node) => node.kind === 'offboard'),
            nameArc,
            terrainY: terrainRow,
            revenueAnnotations: [
                ...badges,
                ...revenueSymbols(
                    drawing,
                    markers,
                    markerArt,
                    hexVertices,
                    symbolPositions[location.id],
                    [
                        ...badges.map((badge) =>
                            box(
                                badge,
                                (badge.width + (badge.arrows ? badge.height : 0)) / 2,
                                badge.height / 2
                            )
                        ),
                        ...(face.labels.length
                            ? [box(drawing.labelPosition, face.labels.join(' ').length * 4.5, 7)]
                            : []),
                        ...(nameArc
                            ? nameArcPoints.map((point) => disc(point, 3))
                            : nameShown && location.name
                              ? [nameBox(nameRows, nameBaseline)]
                              : []),
                        ...(!placement && location.terrain
                            ? [disc({ x: 0, y: terrainRow }, 10)]
                            : []),
                        ...(markers.some((marker) => !markerArt[marker.id])
                            ? [box({ x: 0, y: 36 }, 24, 4)]
                            : []),
                        ...(!placement &&
                        markers.some((marker) => {
                            const art = markerArt[marker.id]
                            return art && ('centeredLabel' in art || 'imageUrl' in art)
                        })
                            ? [box({ x: 0, y: 0 }, 22, 10)]
                            : [])
                    ]
                )
            ],
            divisions: TileEdges.filter((edge) => !joined.includes(edge) && divides(edge)).map(
                segment
            )
        }
    })
    const vertices = locations.flatMap(
        ({ location }) =>
            calculateHexGeometry(
                { orientation: map.definition.orientation, dimensions: { radius: 50 } },
                location.coordinates
            ).vertices
    )
    const x = Math.min(...vertices.map((point) => point.x)) - 26
    const y = Math.min(...vertices.map((point) => point.y)) - 26
    return {
        map,
        locations,
        terrainCostPrefix,
        bounds: {
            x,
            y,
            width: Math.max(...vertices.map((point) => point.x)) - x + 26,
            height: Math.max(...vertices.map((point) => point.y)) - y + 26
        }
    }
}

function liftRevenue(drawing: TileDrawing, lift: number): TileDrawing {
    const index = drawing.nodes.findIndex(
        ({ node, revenueHidden }) => node.kind !== 'junction' && !revenueHidden
    )
    if (index < 0) return drawing
    const nodes = [...drawing.nodes]
    const shown = nodes[index]
    nodes[index] = {
        ...shown,
        revenuePosition: { ...shown.revenuePosition, y: shown.revenuePosition.y - lift },
        revenueCells: shown.revenueCells.map((cell) => ({ ...cell, y: cell.y - lift }))
    }
    return { ...drawing, nodes }
}

// A middle-aligned revenue and the badges beneath it centre on the hex's middle line.
function centreRevenue(
    drawing: TileDrawing,
    badges: RevenueBadge[],
    middle: boolean
): { drawing: TileDrawing; badges: RevenueBadge[] } {
    const shown = drawing.nodes.find(
        ({ node, revenueHidden }) => node.kind !== 'junction' && !revenueHidden
    )
    if (!middle || !shown) return { drawing, badges }
    const cells = shown.revenueCells
    const top = cells.length
        ? Math.min(...cells.map((cell) => cell.y - cell.height / 2))
        : shown.revenuePosition.y - RevenueRadius
    const bottom = Math.max(
        cells.length
            ? Math.max(...cells.map((cell) => cell.y + cell.height / 2))
            : shown.revenuePosition.y + RevenueRadius,
        ...badges.map((badge) => badge.y + badge.height / 2)
    )
    const shift = -(top + bottom) / 2
    return {
        drawing: liftRevenue(drawing, -shift),
        badges: badges.map((badge) => ({ ...badge, y: badge.y + shift }))
    }
}

// Badges stack beneath the first shown revenue, centred on it.
function revenueBadges(
    drawing: TileDrawing,
    markers: NonNullable<MapLocation['markers']>,
    markerArt: Readonly<Record<string, MapMarkerArt>>
): RevenueBadge[] {
    const shown = drawing.nodes.find(
        ({ node, revenueHidden }) => node.kind !== 'junction' && !revenueHidden
    )
    if (!shown) return []
    const cells = shown.revenueCells
    const x = cells.length
        ? cells.reduce((sum, cell) => sum + cell.x, 0) / cells.length
        : shown.revenuePosition.x
    const width = cells.length
        ? Math.max(...cells.map((cell) => cell.x + cell.width / 2)) -
          Math.min(...cells.map((cell) => cell.x - cell.width / 2))
        : RevenueRadius * 2
    let y = cells.length
        ? Math.max(...cells.map((cell) => cell.y + cell.height / 2)) + BadgeLift + 1
        : shown.revenuePosition.y + RevenueRadius + BadgeLift + 1
    const badges: RevenueBadge[] = []
    for (const marker of markers) {
        const art = markerArt[marker.id]
        if (!art || !('revenueBadge' in art)) continue
        const height = 11
        badges.push({
            kind: 'badge',
            markerId: marker.id,
            label: marker.label,
            x,
            y: y + height / 2,
            width: Math.max(width, marker.label.length * 5 + 6),
            height,
            arrows: art.arrows === true
        })
        y += height + 2
    }
    return badges
}

type Obstacle = Point & { halfWidth: number; halfHeight: number; radius: number }
const box = (point: Point, halfWidth: number, halfHeight: number): Obstacle => ({
    ...point,
    halfWidth,
    halfHeight,
    radius: 0
})
const disc = (point: Point, radius: number): Obstacle => ({
    ...point,
    halfWidth: 0,
    halfHeight: 0,
    radius
})
function clearance(point: Point, obstacle: Obstacle): number {
    return (
        Math.hypot(
            Math.max(Math.abs(point.x - obstacle.x) - obstacle.halfWidth, 0),
            Math.max(Math.abs(point.y - obstacle.y) - obstacle.halfHeight, 0)
        ) - obstacle.radius
    )
}

// Long names split at the space nearest their middle.
function splitName(name: string): string[] {
    if (name.length <= 18) return [name]
    const breaks = [...name.matchAll(/\s+/g)].map((match) => match.index)
    if (!breaks.length) return [name]
    const split = breaks.reduce((best, index) =>
        Math.abs(index - name.length / 2) < Math.abs(best - name.length / 2) ? index : best
    )
    return [name.slice(0, split), name.slice(split).trimStart()]
}

// Names print in small type, a line beneath the baseline per row.
function nameBox(rows: readonly string[], baseline: Point): Obstacle {
    const lines = rows.length
    const longest = Math.max(...rows.map((row) => row.length))
    return box(
        { x: baseline.x, y: baseline.y - 1.5 + (lines - 1) * 3 },
        longest * 1.6 + 2,
        3.5 + (lines - 1) * 3
    )
}

// Symbols sit in a row in the clear space nearest the revenue, wholly inside the hex.
type LocationSymbolPositions = SymbolPosition | Readonly<Record<string, SymbolPosition>>
function isSymbolPosition(position: LocationSymbolPositions): position is SymbolPosition {
    return 'x' in position || Array.isArray(position)
}
function symbolPoints(position: LocationSymbolPositions | undefined): readonly Point[] {
    if (!position) return []
    if (!isSymbolPosition(position)) return Object.values(position).flatMap(symbolPoints)
    return 'x' in position ? [position] : position
}

function revenueSymbols(
    drawing: TileDrawing,
    markers: NonNullable<MapLocation['markers']>,
    markerArt: Readonly<Record<string, MapMarkerArt>>,
    vertices: readonly Point[],
    positions: LocationSymbolPositions | undefined,
    printed: readonly Obstacle[]
): RevenueAnnotation[] {
    const shown = drawing.nodes.find(
        ({ node, revenueHidden }) => node.kind !== 'junction' && !revenueHidden
    )
    // A city printed at zero shows no revenue to avoid.
    const printedRevenue =
        shown?.node.kind !== 'junction' &&
        !(shown?.node.revenue.kind === 'fixed' && shown.node.revenue.amount === 0)
    const obstacles: Obstacle[] = [
        ...printed,
        ...drawing.paths.flatMap((path) =>
            Array.from({ length: 21 }, (_, index) => {
                const t = index / 20
                const point = path.spike
                    ? {
                          x: path.spike.base.x + (path.spike.tip.x - path.spike.base.x) * t,
                          y: path.spike.base.y + (path.spike.tip.y - path.spike.base.y) * t
                      }
                    : tilePathPoint(path, t)
                return disc(point, 3.5)
            })
        ),
        ...drawing.nodes.flatMap(({ node, center, slots }) =>
            node.kind === 'city'
                ? slots.map((slot) => disc(slot, 10.5))
                : node.kind === 'town'
                  ? [disc(center, 5)]
                  : []
        ),
        ...(shown && printedRevenue
            ? shown.revenueCells.length
                ? shown.revenueCells.map((cell) => box(cell, cell.width / 2, cell.height / 2))
                : [disc(shown.revenuePosition, RevenueRadius)]
            : [])
    ]
    const edges = vertices.map((a, index) => [a, vertices[(index + 1) % vertices.length]] as const)
    const inset = (point: Point) =>
        Math.min(
            ...edges.map(
                ([a, b]) =>
                    Math.abs((b.x - a.x) * (a.y - point.y) - (a.x - point.x) * (b.y - a.y)) /
                    Math.hypot(b.x - a.x, b.y - a.y)
            )
        )
    const anchor = shown?.revenuePosition ?? { x: 0, y: 0 }
    const symbols: RevenueAnnotation[] = []
    for (const marker of markers) {
        const art = markerArt[marker.id]
        if (!art || !('revenueSymbol' in art)) continue
        // Positions are for every symbol in the location, or by marker.
        const fixed = positions && !isSymbolPosition(positions) ? positions[marker.id] : positions
        const count = marker.count ?? 1
        const step = RevenueRadius * 2 + 1
        const row = (x: number, y: number) =>
            Array.from({ length: count }, (_, index) => ({
                x: x + (index - (count - 1) / 2) * step,
                y
            }))
        let best: { points: Point[]; score: number; distance: number } | undefined = fixed
            ? {
                  points: 'x' in fixed ? row(fixed.x, fixed.y) : fixed.slice(0, count),
                  score: Infinity,
                  distance: 0
              }
            : undefined
        if (!fixed)
            for (let x = -40; x <= 40; x += 2)
                for (let y = -40; y <= 40; y += 2) {
                    const points = row(x, y)
                    if (points.some((point) => inset(point) < RevenueRadius + 1.5)) continue
                    const score = Math.min(
                        ...points.flatMap((point) =>
                            obstacles.map((obstacle) => clearance(point, obstacle) - RevenueRadius)
                        )
                    )
                    const distance = Math.hypot(x - anchor.x, y - anchor.y)
                    const better = !best
                        ? true
                        : score >= 2.5 && best.score >= 2.5
                          ? distance < best.distance
                          : score > best.score
                    if (better) best = { points, score, distance }
                }
        if (!best) continue
        for (const point of best.points) {
            symbols.push({
                kind: 'symbol',
                markerId: marker.id,
                label: marker.label,
                symbol: art.revenueSymbol,
                ...point,
                radius: RevenueRadius
            })
            obstacles.push(disc(point, RevenueRadius))
        }
    }
    return symbols
}

function terrainY(drawing: TileDrawing, face: TileFace, orientation: HexOrientation): number {
    const stops = drawing.nodes.filter(({ node }) => node.kind === 'city' || node.kind === 'town')
    if (!stops.length) return face.paths.length ? 19 : 0
    const bottom = Math.max(
        ...stops.flatMap(({ node, center, slots, slotRadius, dotRadius }) =>
            node.kind === 'city'
                ? slots.length
                    ? slots.map((slot) => slot.y + slotRadius)
                    : [center.y + dotRadius]
                : [center.y + dotRadius]
        )
    )
    // Midway to the hex boundary under the row: a pointy hex narrows to its bottom vertex.
    const boundary = orientation === HexOrientation.Pointy ? 44 : 25 * Math.sqrt(3)
    return (bottom + boundary) / 2
}

// The name centres over the top of the city, turning the least it can to stay off the track.
function arcAroundCity(
    name: string,
    clearance: number,
    below: boolean,
    paths: readonly TileDrawnPath[],
    symbols: readonly Point[]
): NonNullable<MapDrawnLocation['nameArc']> {
    // Under the city the letters stand inside their baseline, so the baseline moves out by their height.
    const radius = below ? clearance + NameArcCapHeight : clearance
    const span = Math.min((Math.PI * 4) / 3, (name.length * 4) / radius)
    const track = paths.flatMap((path) =>
        Array.from({ length: 41 }, (_, index) => {
            const t = index / 40
            return path.spike
                ? {
                      x: path.spike.base.x + (path.spike.tip.x - path.spike.base.x) * t,
                      y: path.spike.base.y + (path.spike.tip.y - path.spike.base.y) * t
                  }
                : tilePathPoint(path, t)
        })
    )
    // Placed symbols count as many crossings as a track running through them.
    const covered = symbols.flatMap((symbol) =>
        Array.from({ length: 9 }, (_, index) => {
            const angle = (index / 9) * Math.PI * 2
            return {
                x: symbol.x + Math.cos(angle) * RevenueRadius * 0.6,
                y: symbol.y + Math.sin(angle) * RevenueRadius * 0.6
            }
        })
    )
    const crossings = (rotation: number) => {
        const middle = (((below ? 90 : -90) + rotation) * Math.PI) / 180
        return [...track, ...covered].filter((point) => {
            const reach = Math.hypot(point.x, point.y)
            const inner = below ? radius - NameArcCapHeight : radius
            if (reach < inner - 4.5 || reach > inner + 10) return false
            const offset = Math.atan2(point.y, point.x) - middle
            const turn = Math.atan2(Math.sin(offset), Math.cos(offset))
            // The track's casing reaches this far either side of its centre line.
            return Math.abs(turn) - TrackHalfWidth / reach <= span / 2 + 0.05
        }).length
    }
    const turns = Array.from({ length: 37 }, (_, index) =>
        index % 2 ? ((index + 1) / 2) * 5 : (-index / 2) * 5
    )
    const rotation = turns.reduce((best, turn) => (crossings(turn) < crossings(best) ? turn : best))
    return { center: { x: 0, y: 0 }, radius, rotation, span, below }
}

function isOffboard(location: MapLocation | undefined): boolean {
    return location?.preprintedTile.nodes.some((node) => node.kind === 'offboard') ?? false
}

export type MapBorderCost = { key: string; x: number; y: number; amount: number; kind: string }

/**
 * Each costed border's cost, once per shared edge, at the middle of that edge, until track meets
 * across it from both sides and no tile lay can be charged for it again.
 */
export function mapBorderCosts(scene: MapDrawing): MapBorderCost[] {
    const tracksTo = (entry: MapDrawnLocation | undefined, edge: TileEdge) =>
        !!entry &&
        rotateTileFace(entry.face, entry.rotation).paths.some((path) =>
            path.endpoints.some((end) => end.kind === 'edge' && end.edge === edge)
        )
    const costs = new Map<string, MapBorderCost>()
    for (const entry of scene.locations.filter((entry) => !entry.hidden))
        for (const { start, end, border } of entry.borders) {
            if (border.kind === 'impassable' || !border.cost) continue
            const neighbor = scene.map.neighbor(entry.location.id, border.edge)
            const across = scene.locations.find((other) => other.location.id === neighbor?.id)
            if (tracksTo(entry, border.edge) && tracksTo(across, rotateTileEdge(border.edge, 3)))
                continue
            const x = entry.center.x + (start.x + end.x) / 2
            const y = entry.center.y + (start.y + end.y) / 2
            const key = `${Math.round(x)},${Math.round(y)}`
            if (!costs.has(key))
                costs.set(key, { key, x, y, amount: border.cost, kind: border.kind })
        }
    return [...costs.values()]
}

export function mapSelectionPoint(scene: MapDrawing, selection: MapSelection): Point {
    const entry = scene.locations.find((entry) => entry.location.id === selection.locationId)
    assertExists(entry, 'Selection requires a map location')
    if (selection.kind === 'hex') return entry.center
    if (selection.kind === 'path') {
        const path = entry.drawing.paths.find((path) => path.id === selection.pathId)
        assertExists(path, 'Selection requires a map path')
        const point = tilePathPoint(path, 0.5)
        return { x: entry.center.x + point.x, y: entry.center.y + point.y }
    }
    const node = entry.drawing.nodes.find((node) => node.node.id === selection.nodeId)
    assertExists(node, 'Selection requires a map node')
    const point = selection.kind === 'slot' ? node.slots[selection.slot] : node.center
    assertExists(point, 'Selection requires a station slot')
    return { x: entry.center.x + point.x, y: entry.center.y + point.y }
}

export function assertMapOverlays(
    scene: MapDrawing,
    tokens: readonly MapToken[],
    routes: readonly MapRoute[],
    reservations: readonly StationReservation[] = []
): void {
    const slots = new Set<string>()
    for (const token of tokens) {
        assert(Number.isInteger(token.slot) && token.slot >= 0, 'Invalid station slot')
        mapSelectionPoint(scene, { kind: 'slot', ...token })
        const key = JSON.stringify([token.locationId, token.nodeId, token.slot])
        assert(!slots.has(key), 'Multiple tokens occupy one station slot')
        slots.add(key)
    }
    for (const reservation of reservations) {
        const entry = scene.locations.find((entry) => entry.location.id === reservation.locationId)
        assert(
            entry?.face.nodes.some(
                (node) => node.id === reservation.nodeId && node.kind === 'city'
            ),
            'Map reservation requires a city'
        )
    }
    for (const route of routes)
        for (const segment of route.segments) mapSelectionPoint(scene, { kind: 'path', ...segment })
}

export function isMapSelectionValid(scene: MapDrawing, selection: MapSelection): boolean {
    const entry = scene.locations.find((entry) => entry.location.id === selection.locationId)
    if (!entry) return false
    if (selection.kind === 'hex') return true
    if (selection.kind === 'path')
        return entry.drawing.paths.some((path) => path.id === selection.pathId)
    const node = entry.drawing.nodes.find((node) => node.node.id === selection.nodeId)
    return !!node && (selection.kind === 'node' || !!node.slots[selection.slot])
}
export function printedMapReservations(scene: MapDrawing): StationReservation[] {
    return scene.locations.flatMap(({ location }) =>
        (location.reservations ?? []).map((reservation) => ({
            ...reservation,
            locationId: location.id
        }))
    )
}

export function mapSelectionRect(
    scene: MapDrawing,
    selection: MapSelection,
    hexDiameter: number,
    radius = 60,
    artwork?: BoardArtwork,
    extents: readonly BoundingBox[] = []
) {
    const point = mapSelectionPoint(scene, selection)
    const { bounds, scale } = mapViewport(scene, hexDiameter, artwork, extents)
    return {
        x: (point.x - bounds.x - radius) * scale,
        y: (point.y - bounds.y - radius) * scale,
        width: radius * 2 * scale,
        height: radius * 2 * scale
    }
}
