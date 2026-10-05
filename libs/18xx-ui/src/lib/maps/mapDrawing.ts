import type { MapViewDefinition, StationAppearance } from './stationPresentation.js'
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
import { createTileDrawing, type TileDrawing, type TileLayout } from '../tiles/tileDrawing.js'
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
    { imageUrl: string } | { tileSymbol: TileSymbolName } | { localLine: true }

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
        locationMarkerNames = {}
    }: Pick<
        MapViewDefinition,
        'layouts' | 'markerArt' | 'placements' | 'joinedEdges' | 'locationMarkerNames'
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
        const drawing = createTileDrawing(face, map.definition.orientation, rotation, {
            ...tileLayout,
            annotationExclusions: [
                ...(tileLayout.annotationExclusions ?? []),
                ...(!placement && location.name
                    ? [
                          { x: -18, y: -38 },
                          { x: 0, y: -38 },
                          { x: 18, y: -38 }
                      ]
                    : []),
                ...(!placement && location.terrain
                    ? [{ x: 0, y: face.nodes.length || face.paths.length ? 23 : 4 }]
                    : []),
                ...(location.upgradeLabels?.length || location.markers?.length
                    ? [{ x: 0, y: 36 }]
                    : [])
            ]
        })
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
            outline: TileEdges.filter((edge) => !joined.includes(edge)).map(segment)
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
        bounds: {
            x,
            y,
            width: Math.max(...vertices.map((point) => point.x)) - x + 26,
            height: Math.max(...vertices.map((point) => point.y)) - y + 26
        }
    }
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
