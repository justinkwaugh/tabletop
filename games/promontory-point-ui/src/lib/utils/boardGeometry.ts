import {
    HexOrientation,
    calculateHexGeometry,
    hexCoordsToCenterPoint,
    type AxialCoordinates,
    type BoundingBox,
    type EllipseDimensions,
    type Point,
    type RectangleDimensions
} from '@tabletop/common'
import {
    BOARD_GRID,
    PRICE_INDICES,
    RAILROAD_IDS,
    type RailroadId,
    type SpaceId
} from '@tabletop/promontory-point'

// Every position is in the supplied map's own pixels, measured off it at that size; the
// method and the measured values are in images/board/README.md.
export const MAP_SIZE: RectangleDimensions = { width: 3571, height: 2302 }

// R-1.1: pointy-top, Promontory at 0,0. The printed hexes are a little squat: the row pitch
// is 153.45, not the regular 162.9 that the column pitch would give.
export const HEX_ORIGIN: Point = { x: 2228.73, y: 1152.09 }
const HEX_PITCH = { x: 188.09, y: 153.45 }
export const HEX: EllipseDimensions = { xRadius: HEX_PITCH.x / 2, yRadius: HEX_PITCH.y / 1.5 }

export function hexCentre(coords: AxialCoordinates): Point {
    const offset = hexCoordsToCenterPoint(coords, HEX, HexOrientation.Pointy)
    return { x: HEX_ORIGIN.x + offset.x, y: HEX_ORIGIN.y + offset.y }
}

export function hexOutline(coords: AxialCoordinates): Point[] {
    return calculateHexGeometry(
        { orientation: HexOrientation.Pointy, dimensions: HEX },
        coords
    ).vertices.map((vertex) => ({ x: HEX_ORIGIN.x + vertex.x, y: HEX_ORIGIN.y + vertex.y }))
}

// R-1.1-H3: every space in the board data, the coastal space -6,5 included.
export const SPACE_CENTRES: ReadonlyMap<SpaceId, Point> = new Map(
    BOARD_GRID.spaces().map((space) => [space.spaceId, hexCentre(space.coords)])
)

export const HOME_HEX_CENTRES: Readonly<Record<RailroadId, Point>> = recordByRailroad(
    (railroadId) => hexCentre(BOARD_GRID.homeHex(railroadId).coords)
)

export function boxCentre(box: BoundingBox): Point {
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

export type PriceTrackSpace = {
    priceIndex: number
    slots: Readonly<Record<RailroadId, BoundingBox>>
}

type Span = { from: number; to: number }

// R-1.2: the sea's top edge, the 22 rules between its rows, and its bottom edge. Rows top to
// bottom hold 25 down to 3 in the left column; the lowest seven also hold, in the right
// column, the five 0 spaces from the top down, then 1 and 2.
const PRICE_ROW_EDGES_Y = [
    127, 204, 294, 384, 474, 564, 654, 743.75, 833.75, 923.5, 1013.5, 1103.5, 1193.5, 1283, 1373,
    1463, 1553, 1643, 1733, 1823, 1913, 2003, 2093, 2177
]
const PRICE_ROWS = PRICE_ROW_EDGES_Y.length - 1
const RIGHT_COLUMN_ROWS = 7

// Each column's four slots share the space beside its printed numeral.
const LEFT_COLUMN_SLOTS: Span = { from: 130, to: 539 }
const RIGHT_COLUMN_SLOTS: Span = { from: 694, to: 1120 }

function priceTrackSpace(priceIndex: number): PriceTrackSpace {
    const inLeftColumn = priceIndex >= RIGHT_COLUMN_ROWS
    const row = inLeftColumn
        ? PRICE_ROWS - 1 - (priceIndex - RIGHT_COLUMN_ROWS)
        : PRICE_ROWS - RIGHT_COLUMN_ROWS + priceIndex
    const top = PRICE_ROW_EDGES_Y[row]
    const height = PRICE_ROW_EDGES_Y[row + 1] - top
    const span = inLeftColumn ? LEFT_COLUMN_SLOTS : RIGHT_COLUMN_SLOTS
    const width = (span.to - span.from) / RAILROAD_IDS.length
    return {
        priceIndex,
        slots: recordByRailroad((railroadId) => ({
            x: span.from + width * RAILROAD_IDS.indexOf(railroadId),
            y: top,
            width,
            height
        }))
    }
}

export const PRICE_TRACK_SPACES: readonly PriceTrackSpace[] = PRICE_INDICES.map(priceTrackSpace)

export const BORDER_TRACK_LENGTH = 100

export type BorderTrackSpace = {
    value: number
    box: BoundingBox
    sharingSlots: readonly BoundingBox[]
}

// R-1.3-H1: the band's inner edges (the corner squares' outlines) and the rules between its
// spaces, left to right along the top and bottom, top to bottom down the sides.
const BORDER_INNER_EDGES = { left: 115, top: 111, right: 3460, bottom: 2192 }
const TOP_RULES_X = [
    227.5, 343.5, 459, 574, 689, 805.5, 920.5, 1035.5, 1150, 1269.5, 1383.5, 1499, 1614, 1729,
    1845.5, 1961, 2075.5, 2192, 2304.5, 2424, 2538.5, 2654, 2769.5, 2885.5, 3001, 3115.5, 3231,
    3347.5
]
const BOTTOM_RULES_X = [
    227.5, 343.5, 459, 574, 689, 805.5, 920.5, 1035.5, 1150, 1270, 1383.5, 1499, 1614, 1729, 1845.5,
    1961, 2075.5, 2192, 2305, 2424, 2539.5, 2654, 2769.5, 2885.5, 3001.5, 3115.5, 3231, 3347.5
]
const LEFT_RULES_Y = [
    219, 328, 437.5, 547.5, 657, 766, 875.5, 984, 1092.5, 1212, 1319.5, 1429.5, 1536.5, 1648, 1758,
    1865.5, 1975.5, 2085.5
]
const RIGHT_RULES_Y = [
    219, 328, 437.5, 547.5, 657, 766, 875.5, 985.5, 1092.5, 1212, 1319.5, 1429.5, 1537, 1647.5,
    1758, 1866.5, 1975.5, 2085.5
]

function spans(from: number, rules: number[], to: number): Span[] {
    const edges = [from, ...rules, to]
    return edges.slice(1).map((edge, i) => ({ from: edges[i], to: edge }))
}

function box(xs: Span, ys: Span): BoundingBox {
    return { x: xs.from, y: ys.from, width: xs.to - xs.from, height: ys.to - ys.from }
}

function borderBoxes(): BoundingBox[] {
    const { left, top, right, bottom } = BORDER_INNER_EDGES
    const { width, height } = MAP_SIZE
    const leftBand: Span = { from: 0, to: left }
    const rightBand: Span = { from: right, to: width }
    const topBand: Span = { from: 0, to: top }
    const bottomBand: Span = { from: bottom, to: height }
    return [
        box(leftBand, bottomBand),
        ...spans(top, LEFT_RULES_Y, bottom)
            .reverse()
            .map((ys) => box(leftBand, ys)),
        box(leftBand, topBand),
        ...spans(left, TOP_RULES_X, right).map((xs) => box(xs, topBand)),
        box(rightBand, topBand),
        ...spans(top, RIGHT_RULES_Y, bottom).map((ys) => box(rightBand, ys)),
        box(rightBand, bottomBand),
        ...spans(left, BOTTOM_RULES_X, right)
            .reverse()
            .map((xs) => box(xs, bottomBand))
    ]
}

function quarters(space: BoundingBox): BoundingBox[] {
    const width = space.width / 2
    const height = space.height / 2
    return [0, 1].flatMap((row) =>
        [0, 1].map((column) => ({
            x: space.x + column * width,
            y: space.y + row * height,
            width,
            height
        }))
    )
}

export const BORDER_TRACK_SPACES: readonly BorderTrackSpace[] = borderBoxes().map(
    (space, value) => ({ value, box: space, sharingSlots: quarters(space) })
)

export type SeaSlots = {
    bag: BoundingBox
    endTracker: BoundingBox
    decks: Readonly<Record<RailroadId, BoundingBox>>
}

const DECK_SIZE: RectangleDimensions = { width: 124, height: 193 }
const DECK_ORIGINS: Record<RailroadId, Point> = {
    'railroad.cp': { x: 643, y: 744 },
    'railroad.up': { x: 788, y: 744 },
    'railroad.kp': { x: 643, y: 964 },
    'railroad.sp': { x: 788, y: 964 }
}

// R-1.3, O-8: the share decks, the bag and the end tracker in the open sea right of the price
// track, inside the measured coast.
export const SEA_SLOTS: SeaSlots = {
    bag: { x: 642, y: 225, width: 140, height: 170 },
    endTracker: { x: 645, y: 1270, width: 380, height: 250 },
    decks: recordByRailroad((railroadId) => ({ ...DECK_ORIGINS[railroadId], ...DECK_SIZE }))
}

function recordByRailroad<T>(value: (railroadId: RailroadId) => T): Record<RailroadId, T> {
    return {
        'railroad.cp': value('railroad.cp'),
        'railroad.up': value('railroad.up'),
        'railroad.kp': value('railroad.kp'),
        'railroad.sp': value('railroad.sp')
    }
}
