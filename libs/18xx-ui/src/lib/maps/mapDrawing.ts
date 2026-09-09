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

export type MapToken = {
    id: string
    locationId: string
    nodeId: string
    slot: number
    label: string
    color: string
}
export type MapRoute = {
    id: string
    color: string
    segments: readonly { locationId: string; pathId: string }[]
}
export type MapDrawnLocation = {
    location: MapLocation
    center: Point
    face: TileFace
    rotation: TileRotation
    placed: boolean
    drawing: TileDrawing
    borders: readonly {
        start: Point
        end: Point
        border: NonNullable<MapLocation['borders']>[number]
    }[]
}
export type MapDrawing = {
    map: RailwayMap
    locations: readonly MapDrawnLocation[]
    bounds: BoundingBox
}

export function createMapDrawing(
    map: RailwayMap,
    supply?: { tileSet: TileSet; inventory: TileInventory },
    layouts: Readonly<Record<string, TileLayout>> = {}
): MapDrawing {
    const inventory = supply?.tileSet.parseInventory(supply.inventory)
    const definitions = new Map(
        supply?.tileSet.definitions.map((definition) => [definition.id, definition])
    )
    for (const id of Object.keys(inventory?.placements ?? {})) map.location(id)
    const locations = map.definition.locations.map((location): MapDrawnLocation => {
        const placement = inventory?.placements[location.id]
        const definition = placement ? definitions.get(placement.definitionId) : undefined
        if (placement) assertExists(definition, 'Placed map tile requires a definition')
        const face = definition?.face ?? location.preprintedTile
        const rotation = placement?.rotation ?? 0
        const layout = definition
            ? (layouts[definition.id] ?? StandardTileLayouts[definition.id])
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
                { x: -18, y: -38 },
                { x: 0, y: -38 },
                { x: 18, y: -38 },
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
    const x = Math.min(...vertices.map((point) => point.x)) - 12
    const y = Math.min(...vertices.map((point) => point.y)) - 12
    return {
        map,
        locations,
        bounds: {
            x,
            y,
            width: Math.max(...vertices.map((point) => point.x)) - x + 12,
            height: Math.max(...vertices.map((point) => point.y)) - y + 12
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
    routes: readonly MapRoute[]
): void {
    const slots = new Set<string>()
    for (const token of tokens) {
        assert(Number.isInteger(token.slot) && token.slot >= 0, 'Invalid station slot')
        mapSelectionPoint(scene, { kind: 'slot', ...token })
        const key = JSON.stringify([token.locationId, token.nodeId, token.slot])
        assert(!slots.has(key), 'Multiple tokens occupy one station slot')
        slots.add(key)
    }
    for (const route of routes)
        for (const segment of route.segments) mapSelectionPoint(scene, { kind: 'path', ...segment })
}
