import {
    assertExists,
    calculateHexGeometry,
    HexOrientation,
    type BoundingBox,
    type HexGeometry,
    type Point,
    type RectangleDimensions
} from '@tabletop/common'
import {
    doubledToAxial,
    usaCity,
    USA_HEXES,
    type CityId,
    type HexId
} from '@tabletop/ride-the-rails'

export const HEX_SIZE = 40
export const HEX_WIDTH = Math.sqrt(3) * HEX_SIZE
/** Art plan, Board: the board is cropped to the land, with a band of sea around it. */
export const BOARD_MARGIN = 40

const HEX_DEFINITION = {
    orientation: HexOrientation.Pointy,
    dimensions: { radius: HEX_SIZE }
}

const UNPLACED_GEOMETRY: ReadonlyMap<HexId, HexGeometry> = new Map(
    USA_HEXES.map((hex) => [hex.id, calculateHexGeometry(HEX_DEFINITION, doubledToAxial(hex))])
)

function boundsOf(points: readonly Point[]): BoundingBox {
    const xs = points.map((point) => point.x)
    const ys = points.map((point) => point.y)
    const x = Math.min(...xs)
    const y = Math.min(...ys)
    return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y }
}

const UNPLACED_MAP_BOUNDS = boundsOf(
    [...UNPLACED_GEOMETRY.values()].flatMap((geometry) => geometry.vertices)
)

const ORIGIN: Point = {
    x: BOARD_MARGIN - UNPLACED_MAP_BOUNDS.x,
    y: BOARD_MARGIN - UNPLACED_MAP_BOUNDS.y
}

function placed(point: Point): Point {
    return { x: point.x + ORIGIN.x, y: point.y + ORIGIN.y }
}

export const MAP_EXTENTS: BoundingBox = { ...UNPLACED_MAP_BOUNDS, ...placed(UNPLACED_MAP_BOUNDS) }

export const BOARD_WIDTH = MAP_EXTENTS.width + 2 * BOARD_MARGIN
export const BOARD_HEIGHT = MAP_EXTENTS.height + 2 * BOARD_MARGIN
export const BOARD_EXTENTS: BoundingBox = { x: 0, y: 0, width: BOARD_WIDTH, height: BOARD_HEIGHT }

const HEX_GEOMETRY: ReadonlyMap<HexId, HexGeometry> = new Map(
    [...UNPLACED_GEOMETRY].map(([hexId, geometry]) => [
        hexId,
        {
            center: placed(geometry.center),
            vertices: geometry.vertices.map(placed),
            boundingBox: { ...geometry.boundingBox, ...placed(geometry.boundingBox) }
        }
    ])
)

export function hexGeometry(hexId: HexId): HexGeometry {
    const geometry = HEX_GEOMETRY.get(hexId)
    assertExists(geometry, `No geometry for hex ${hexId}`)
    return geometry
}

export function hexCenter(hexId: HexId): Point {
    return hexGeometry(hexId).center
}

/** The box around a hex, as wide as its flats and as tall as its points. */
export function hexBox(hexId: HexId): BoundingBox {
    const center = hexCenter(hexId)
    return {
        x: center.x - HEX_WIDTH / 2,
        y: center.y - HEX_SIZE,
        width: HEX_WIDTH,
        height: HEX_SIZE * 2
    }
}

export function hexCorners(hexId: HexId): readonly Point[] {
    return hexGeometry(hexId).vertices
}

/** A point as SVG writes it, to a tenth of a board unit. */
export function pointText({ x, y }: Point): string {
    return `${x.toFixed(1)},${y.toFixed(1)}`
}

/** A closed SVG path through the points. */
export function closedPath(points: readonly Point[]): string {
    return `M${points.map(pointText).join('L')}Z`
}

export function hexPoints(hexId: HexId): string {
    return hexCorners(hexId).map(pointText).join(' ')
}

export type Station = Point & { radius: number }

const STATION_RADIUS = 12
const STATION_RISE = 8
const CHICAGO_STATION_RADIUS = 10

// The point a journey's flights start from and pulse at in each city: Chicago's centre, between its
// two rows of track, and a little above every other city's centre.
export function stationOf(cityId: CityId): Station {
    const city = usaCity(cityId)
    const center = hexCenter(city.hexId)
    return city.capacity === 'unlimited'
        ? { ...center, radius: CHICAGO_STATION_RADIUS }
        : { x: center.x, y: center.y - STATION_RISE, radius: STATION_RADIUS }
}

/**
 * The board a 1280 × 900 desktop window leaves for the map beside the sidebar, under the turn
 * header, the action area and the railroad cards.
 */
export const DESKTOP_BOARD_VIEW: RectangleDimensions = { width: 940, height: 564 }

export const FITTED_DESKTOP_SCALE = Math.min(
    DESKTOP_BOARD_VIEW.width / BOARD_WIDTH,
    DESKTOP_BOARD_VIEW.height / BOARD_HEIGHT,
    1
)
