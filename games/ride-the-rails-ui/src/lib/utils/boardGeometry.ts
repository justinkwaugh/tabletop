import {
    assertExists,
    calculateHexGeometry,
    HexOrientation,
    type AxialCoordinates,
    type BoundingBox,
    type HexGeometry,
    type Point,
    type RectangleDimensions
} from '@tabletop/common'
import {
    boardMap,
    cityById,
    MAP_IDS,
    type BoardMap,
    type City,
    type CityId,
    type HexId,
    type MapId
} from '@tabletop/ride-the-rails'
import { hexFrame, type HexFrame } from './hexFrame.js'

export const HEX_SIZE = 40
/** A hex's width across its flats, either way up. */
export const HEX_WIDTH = Math.sqrt(3) * HEX_SIZE
/** Art plan, Board: the board is cropped to the land, with a band of sea around it. */
export const BOARD_MARGIN = 40

/**
 * The board a 1280 × 900 desktop window leaves for the map beside the sidebar, under the turn
 * header, the action area and the railroad cards.
 */
export const DESKTOP_BOARD_VIEW: RectangleDimensions = { width: 940, height: 564 }

/** Where a hex stands on its board, in board units. */
export type HexPlace = {
    /** Its one cell's centre, or the mean of its cells' centres. */
    readonly center: Point
    /** Each cell the hex covers (R-8: Berlin covers two), its id's cell first. */
    readonly cells: readonly HexGeometry[]
    /** The box round its cells, each cell as wide and as tall as its corners reach. */
    readonly box: BoundingBox
    /** Its outline round every cell it covers: a cell's own six corners when it has one. */
    readonly outline: readonly Point[]
}

export type Station = Point & { radius: number }

/** One map's board: where its hexes stand, and the board's size round them. */
export type BoardGeometry = {
    readonly mapId: MapId
    readonly map: BoardMap
    readonly orientation: HexOrientation
    readonly hexFrame: HexFrame
    /** The map's hexes, in its reading order. */
    readonly hexIds: readonly HexId[]
    readonly width: number
    readonly height: number
    /** The whole board, sea included, from the origin. */
    readonly extents: BoundingBox
    /** The bounding box of the map's hexes. */
    readonly mapExtents: BoundingBox
    /** The scale the whole board is drawn at in a desktop window, never past full size. */
    readonly fittedDesktopScale: number
    /** The land's outline as one SVG path: every side no two of its hexes share. */
    readonly landPath: string
    place(hexId: HexId): HexPlace
    /** A cell of the board's grid, on the map or off it, placed as the map's cells are. */
    cellAt(cell: AxialCoordinates): HexGeometry
    station(cityId: CityId): Station
}

function boundsOf(points: readonly Point[]): BoundingBox {
    const xs = points.map((point) => point.x)
    const ys = points.map((point) => point.y)
    const x = Math.min(...xs)
    const y = Math.min(...ys)
    return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y }
}

function unionOf(boxes: readonly BoundingBox[]): BoundingBox {
    const [first, ...rest] = boxes
    assertExists(first, 'No boxes to join')
    return rest.reduce((joined, box) => {
        const x = Math.min(joined.x, box.x)
        const y = Math.min(joined.y, box.y)
        return {
            x,
            y,
            width: Math.max(joined.x + joined.width, box.x + box.width) - x,
            height: Math.max(joined.y + joined.height, box.y + box.height) - y
        }
    }, first)
}

/** A cell's box: on a pointy map as wide as its flats and as tall as its points, flat the other way. */
function cellBox(center: Point, orientation: HexOrientation): BoundingBox {
    return orientation === HexOrientation.Pointy
        ? {
              x: center.x - HEX_WIDTH / 2,
              y: center.y - HEX_SIZE,
              width: HEX_WIDTH,
              height: HEX_SIZE * 2
          }
        : {
              x: center.x - HEX_SIZE,
              y: center.y - HEX_WIDTH / 2,
              width: HEX_SIZE * 2,
              height: HEX_WIDTH
          }
}

function pointKey(point: Point): string {
    return `${point.x.toFixed(2)},${point.y.toFixed(2)}`
}

/**
 * The outline of a set of cells: every side no two of them share, chained into closed loops.
 * Three cells meet at each corner and any two of them are neighbours, so each corner on the
 * outline joins exactly two of its sides.
 */
export function outlineLoops(cells: readonly (readonly Point[])[]): Point[][] {
    const sides = new Map<string, { from: Point; to: Point; count: number }>()
    for (const corners of cells) {
        corners.forEach((from, index) => {
            const to = corners[(index + 1) % corners.length]
            const key = [pointKey(from), pointKey(to)].sort().join(' ')
            const side = sides.get(key)
            if (side) side.count += 1
            else sides.set(key, { from, to, count: 1 })
        })
    }
    const points = new Map<string, Point>()
    const next = new Map<string, string[]>()
    for (const { from, to, count } of sides.values()) {
        if (count !== 1) continue
        const [a, b] = [pointKey(from), pointKey(to)]
        points.set(a, from)
        points.set(b, to)
        next.set(a, [...(next.get(a) ?? []), b])
        next.set(b, [...(next.get(b) ?? []), a])
    }
    const visited = new Set<string>()
    const loops: Point[][] = []
    for (const start of next.keys()) {
        if (visited.has(start)) continue
        const loop: Point[] = []
        let previous: string | undefined
        let current = start
        while (!visited.has(current)) {
            visited.add(current)
            const point = points.get(current)
            const ends = next.get(current)
            assertExists(point)
            assertExists(ends)
            const step = ends[0] === previous ? ends[1] : ends[0]
            assertExists(step)
            loop.push(point)
            previous = current
            current = step
        }
        loops.push(loop)
    }
    return loops
}

/**
 * A closed outline with every side moved in by `distance`, each corner where its two moved sides
 * meet, so a corner that turns in (where Berlin's two cells meet) stays a sharp corner too.
 */
export function insetLoop(points: readonly Point[], distance: number): Point[] {
    const area = points.reduce((sum, point, index) => {
        const next = points[(index + 1) % points.length] ?? point
        return sum + point.x * next.y - next.x * point.y
    }, 0)
    // The inward side of each side, whichever way the outline runs.
    const turn = area > 0 ? 1 : -1
    const moved = points.map((from, index) => {
        const to = points[(index + 1) % points.length] ?? from
        const length = Math.hypot(to.x - from.x, to.y - from.y)
        const normal = {
            x: (-(to.y - from.y) / length) * turn,
            y: ((to.x - from.x) / length) * turn
        }
        return {
            from: { x: from.x + normal.x * distance, y: from.y + normal.y * distance },
            to: { x: to.x + normal.x * distance, y: to.y + normal.y * distance }
        }
    })
    return moved.map((side, index) => {
        const before = moved[(index - 1 + moved.length) % moved.length] ?? side
        const r = { x: before.to.x - before.from.x, y: before.to.y - before.from.y }
        const s = { x: side.to.x - side.from.x, y: side.to.y - side.from.y }
        const cross = r.x * s.y - r.y * s.x
        if (Math.abs(cross) < 1e-9) return side.from
        const t =
            ((side.from.x - before.from.x) * s.y - (side.from.y - before.from.y) * s.x) / cross
        return { x: before.from.x + r.x * t, y: before.from.y + r.y * t }
    })
}

/** A point as SVG writes it, to a tenth of a board unit. */
export function pointText({ x, y }: Point): string {
    return `${x.toFixed(1)},${y.toFixed(1)}`
}

/** A closed SVG path through the points. */
export function closedPath(points: readonly Point[]): string {
    return `M${points.map(pointText).join('L')}Z`
}

const STATION_RADIUS = 12
const STATION_RISE = 8
const CHICAGO_STATION_RADIUS = 10

// The point a journey's flights start from and pulse at in each city: Chicago's centre, between its
// two rows of track, and a little above every other city's centre.
function stationAt(city: City, center: Point): Station {
    return city.capacity === 'unlimited'
        ? { ...center, radius: CHICAGO_STATION_RADIUS }
        : { x: center.x, y: center.y - STATION_RISE, radius: STATION_RADIUS }
}

function meanOf(points: readonly Point[]): Point {
    return {
        x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
        y: points.reduce((sum, point) => sum + point.y, 0) / points.length
    }
}

/**
 * Art plan, Geometry from data: a map's board, each cell placed by the platform's hex geometry for
 * the map's orientation, the whole moved so the land starts a margin in from the board's corner.
 */
export function geometryOf(map: BoardMap): BoardGeometry {
    const definition = { orientation: map.orientation, dimensions: { radius: HEX_SIZE } }
    const unplaced: ReadonlyMap<HexId, HexGeometry[]> = new Map(
        map.hexes.map((hex) => [
            hex.id,
            map.cellsOf(hex.id).map((cell) => calculateHexGeometry(definition, cell))
        ])
    )
    const unplacedBounds = boundsOf(
        [...unplaced.values()].flatMap((cells) => cells.flatMap((cell) => cell.vertices))
    )
    const origin: Point = {
        x: BOARD_MARGIN - unplacedBounds.x,
        y: BOARD_MARGIN - unplacedBounds.y
    }
    const placed = (point: Point): Point => ({ x: point.x + origin.x, y: point.y + origin.y })
    const placedCell = (cell: HexGeometry): HexGeometry => ({
        center: placed(cell.center),
        vertices: cell.vertices.map(placed),
        boundingBox: { ...cell.boundingBox, ...placed(cell.boundingBox) }
    })

    const places: ReadonlyMap<HexId, HexPlace> = new Map(
        [...unplaced].map(([hexId, unplacedCells]): [HexId, HexPlace] => {
            const cells = unplacedCells.map(placedCell)
            const [first] = cells
            assertExists(first, `Hex ${hexId} covers no cell`)
            const [outline] =
                cells.length === 1
                    ? [first.vertices]
                    : outlineLoops(cells.map((cell) => cell.vertices))
            assertExists(outline, `Hex ${hexId} has no outline`)
            return [
                hexId,
                {
                    center:
                        cells.length === 1
                            ? first.center
                            : meanOf(cells.map((cell) => cell.center)),
                    cells,
                    box: unionOf(cells.map((cell) => cellBox(cell.center, map.orientation))),
                    outline
                }
            ]
        })
    )
    const place = (hexId: HexId): HexPlace => {
        const hexPlace = places.get(hexId)
        assertExists(hexPlace, `No geometry for hex ${hexId} on ${map.id}`)
        return hexPlace
    }

    const mapExtents: BoundingBox = { ...unplacedBounds, ...placed(unplacedBounds) }
    const width = mapExtents.width + 2 * BOARD_MARGIN
    const height = mapExtents.height + 2 * BOARD_MARGIN
    const hexIds = map.hexes.map((hex) => hex.id)
    return {
        mapId: map.id,
        map,
        orientation: map.orientation,
        hexFrame: hexFrame(map.orientation),
        hexIds,
        width,
        height,
        extents: { x: 0, y: 0, width, height },
        mapExtents,
        fittedDesktopScale: Math.min(
            DESKTOP_BOARD_VIEW.width / width,
            DESKTOP_BOARD_VIEW.height / height,
            1
        ),
        landPath: outlineLoops(hexIds.map((hexId) => place(hexId).outline))
            .map(closedPath)
            .join(''),
        place,
        cellAt: (cell) => placedCell(calculateHexGeometry(definition, cell)),
        station: (cityId) => {
            const city = map.city(cityId)
            return stationAt(city, place(city.hexId).center)
        }
    }
}

// Each map's board, built once.
const GEOMETRIES: ReadonlyMap<MapId, BoardGeometry> = new Map(
    MAP_IDS.map((mapId) => [mapId, geometryOf(boardMap(mapId))])
)

export function boardGeometry(mapId: MapId): BoardGeometry {
    const geometry = GEOMETRIES.get(mapId)
    assertExists(geometry, `No board for ${mapId}`)
    return geometry
}

type PlacedHex = { geometry: BoardGeometry; place: HexPlace }

// Hex ids name their map, so where a hex stands needs no map id.
const HEX_PLACES: ReadonlyMap<HexId, PlacedHex> = new Map(
    [...GEOMETRIES.values()].flatMap((geometry) =>
        geometry.hexIds.map((hexId): [HexId, PlacedHex] => [
            hexId,
            { geometry, place: geometry.place(hexId) }
        ])
    )
)

function placedHex(hexId: HexId): PlacedHex {
    const found = HEX_PLACES.get(hexId)
    assertExists(found, `No geometry for hex ${hexId}`)
    return found
}

export function hexCenter(hexId: HexId): Point {
    return placedHex(hexId).place.center
}

/** The box around a hex: on a pointy map as wide as its flats and as tall as its points. */
export function hexBox(hexId: HexId): BoundingBox {
    return placedHex(hexId).place.box
}

/** Each cell a hex covers, its id's cell first. */
export function hexCells(hexId: HexId): readonly HexGeometry[] {
    return placedHex(hexId).place.cells
}

/** The hex's outline round every cell it covers. */
export function hexOutline(hexId: HexId): readonly Point[] {
    return placedHex(hexId).place.outline
}

/** How the marks inside the hex turn: the frame of its map's orientation. */
export function hexFrameOf(hexId: HexId): HexFrame {
    return placedHex(hexId).geometry.hexFrame
}

export function hexPoints(hexId: HexId): string {
    return hexOutline(hexId).map(pointText).join(' ')
}

export function stationOf(cityId: CityId): Station {
    const city = cityById(cityId)
    return stationAt(city, hexCenter(city.hexId))
}
