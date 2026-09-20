import type { StationAppearance } from './stationPresentation.js'
import {
    assert,
    assertExists,
    calculateHexGeometry,
    ClockwiseFlatHexDirections,
    ClockwisePointyHexDirections,
    HexOrientation,
    type BoundingBox,
    type Point
} from '@tabletop/common'
import {
    tileEdgeDirection,
    RailwayMapState,
    type RoutePath,
    type StationPosition,
    type StationReservation,
    type RailwayMap,
    type MapLocation,
    type TileFace,
    type TileRotation,
    type TileSet,
    type TileInventory
} from '@tabletop/18xx'
import { createTileDrawing, type TileDrawing, type TileLayout } from '../tiles/tileDrawing.js'
import { StandardTileLayouts } from '../tiles/standardTileLayouts.js'
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
export type MapDrawnLocation = {
    location: MapLocation
    center: Point
    face: TileFace
    rotation: TileRotation
    placed: boolean
    markerImages: Readonly<Record<string, string>>
    drawing: TileDrawing
    borders: readonly {
        start: Point
        end: Point
        border: NonNullable<MapLocation['borders']>[number]
    }[]
}
export type BoardArtwork = {
    backgroundColor?: string
    imageUrl: string
    width: number
    height: number
    origin: Point
    scale: number
}

export function mapViewport(scene: MapDrawing, hexDiameter: number, artwork?: BoardArtwork) {
    const scale = artwork?.scale ?? hexDiameter / 100
    const bounds = artwork
        ? {
              x: -artwork.origin.x / scale,
              y: -artwork.origin.y / scale,
              width: artwork.width / scale,
              height: artwork.height / scale
          }
        : scene.bounds
    return { bounds, scale, width: bounds.width * scale, height: bounds.height * scale }
}

export type MapDrawing = {
    map: RailwayMap
    locations: readonly MapDrawnLocation[]
    bounds: BoundingBox
}

export function createMapDrawing(
    map: RailwayMap,
    supply?: { tileSet: TileSet; inventory: TileInventory },
    layouts: Readonly<Record<string, TileLayout>> = {},
    markerImages: Readonly<Record<string, string>> = {}
): MapDrawing {
    const mapState = supply ? new RailwayMapState(map, supply.tileSet, supply.inventory) : undefined
    const locations = map.definition.locations.map((location): MapDrawnLocation => {
        const tile = mapState?.tile(location.id)
        const placement = tile?.placement
        const face = tile?.face ?? location.preprintedTile
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
            location.coordinates
        )
        const borders = (location.borders ?? []).map((border) => {
            const direction = tileEdgeDirection(border.edge, map.definition.orientation)
            const index =
                map.definition.orientation === HexOrientation.Flat
                    ? ClockwiseFlatHexDirections.findIndex((candidate) => candidate === direction)
                    : ClockwisePointyHexDirections.findIndex((candidate) => candidate === direction)
            const a = geometry.vertices[index],
                b = geometry.vertices[(index + 1) % 6]
            return {
                border,
                start: { x: a.x - geometry.center.x, y: a.y - geometry.center.y },
                end: { x: b.x - geometry.center.x, y: b.y - geometry.center.y }
            }
        })
        return {
            location,
            center: geometry.center,
            face,
            rotation,
            placed: !!placement,
            drawing,
            markerImages,
            borders
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
    artwork?: BoardArtwork
) {
    const point = mapSelectionPoint(scene, selection)
    const { bounds, scale } = mapViewport(scene, hexDiameter, artwork)
    return {
        x: (point.x - bounds.x - radius) * scale,
        y: (point.y - bounds.y - radius) * scale,
        width: radius * 2 * scale,
        height: radius * 2 * scale
    }
}
