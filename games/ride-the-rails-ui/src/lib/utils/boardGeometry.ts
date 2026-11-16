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

const CITY_LABEL_SCREEN_SIZE = 10

/** City names keep their screen size as the view zooms in, and stop growing on the board below the fitted desktop scale. */
export function cityLabelFontSize(viewScale: number): number {
    return CITY_LABEL_SCREEN_SIZE / Math.max(viewScale, FITTED_DESKTOP_SCALE)
}

export const LARGEST_CITY_LABEL_FONT_SIZE = cityLabelFontSize(FITTED_DESKTOP_SCALE)

/** Contract, Phone layout: a phone's whole map would draw names about 4 px high, so it leaves them off; a press shows the city. */
const MIN_CITY_LABEL_SCREEN_SIZE = 6

export function drawsCityLabels(viewScale: number): boolean {
    return cityLabelFontSize(viewScale) * viewScale >= MIN_CITY_LABEL_SCREEN_SIZE
}

export type LabelSide = 'above' | 'below' | 'left' | 'right'

// Every city's label sits below it but these, where the coast, a neighbour or the board's edge is
// in the way.
const CITY_LABEL_SIDES: ReadonlyMap<CityId, LabelSide> = new Map<CityId, LabelSide>([
    ['city.usa.miami', 'right'],
    ['city.usa.portland-or', 'right'],
    ['city.usa.portland-me', 'left'],
    ['city.usa.baltimore', 'left'],
    ['city.usa.washington', 'above'],
    ['city.usa.charleston', 'above']
])

function cityLabelSide(cityId: CityId): LabelSide {
    return CITY_LABEL_SIDES.get(cityId) ?? 'below'
}

/**
 * The advance of each letter the city names use in the board's serif, Libre Baskerville Bold, in
 * em, read once from the font file: a name's room on the board is the sum of its letters.
 */
export const SERIF_ADVANCE_EM: Readonly<Record<string, number>> = {
    ' ': 0.266,
    '(': 0.343,
    ')': 0.343,
    A: 0.809,
    B: 0.797,
    C: 0.823,
    D: 0.919,
    E: 0.764,
    F: 0.689,
    G: 0.876,
    H: 0.945,
    J: 0.407,
    K: 0.822,
    L: 0.755,
    M: 1.145,
    N: 0.94,
    O: 0.943,
    P: 0.717,
    R: 0.815,
    S: 0.663,
    T: 0.827,
    V: 0.805,
    W: 1.227,
    Y: 0.76,
    a: 0.574,
    b: 0.674,
    c: 0.564,
    d: 0.694,
    e: 0.585,
    f: 0.443,
    g: 0.61,
    h: 0.714,
    i: 0.361,
    k: 0.664,
    l: 0.355,
    m: 1.106,
    n: 0.727,
    o: 0.66,
    p: 0.697,
    r: 0.498,
    s: 0.466,
    t: 0.382,
    u: 0.709,
    v: 0.624,
    w: 0.891,
    x: 0.648,
    y: 0.646
}

/** A letter the table lacks is given the widest capital's room. */
const WIDEST_LETTER_EM = 1.227

export function nameWidthEm(name: string): number {
    return [...name].reduce(
        (sum, letter) => sum + (SERIF_ADVANCE_EM[letter] ?? WIDEST_LETTER_EM),
        0
    )
}

export type CityLabel = Point & {
    textAnchor: 'start' | 'middle' | 'end'
    fontSize: number
    /** The room the name is given on the board, estimated from its length: nothing is measured at run time. */
    box: BoundingBox
}

// A name above its city clears the passenger and the capacity at the top of the hex; a name below
// clears the cubes standing low in it (cityMarks.ts, trackLayout.ts).
const LABEL_ABOVE_REACH = 37
const LABEL_BELOW_REACH = 35
const LABEL_SIDE_REACH = HEX_WIDTH / 2
const LABEL_HEIGHT_EM = 1.2
const BASELINE_EM = 0.95

export function cityLabel(
    cityId: CityId,
    fontSize: number = LARGEST_CITY_LABEL_FONT_SIZE
): CityLabel {
    return labelOn(cityId, cityLabelSide(cityId), fontSize)
}

/**
 * The name a city carries on the map: its name without the state that tells the two Portlands
 * apart, since the map beside it already does. Text with no map beside it keeps the full name.
 */
export function mapLabelName(cityId: CityId): string {
    return usaCity(cityId).name.replace(/ \([^)]*\)$/, '')
}

function labelOn(cityId: CityId, side: LabelSide, fontSize: number): CityLabel {
    const city = usaCity(cityId)
    const center = hexCenter(city.hexId)
    const station = stationOf(cityId)
    const width = nameWidthEm(mapLabelName(cityId)) * fontSize
    const height = LABEL_HEIGHT_EM * fontSize
    const boxTop = {
        above: center.y - LABEL_ABOVE_REACH - height,
        below: center.y + LABEL_BELOW_REACH,
        left: station.y - height / 2,
        right: station.y - height / 2
    }
    const textAnchor = side === 'left' ? 'end' : side === 'right' ? 'start' : 'middle'
    const x =
        side === 'left'
            ? center.x - LABEL_SIDE_REACH
            : side === 'right'
              ? center.x + LABEL_SIDE_REACH
              : center.x
    const boxLeft = textAnchor === 'end' ? x - width : textAnchor === 'start' ? x : x - width / 2
    return {
        x,
        y: boxTop[side] + BASELINE_EM * fontSize,
        textAnchor,
        fontSize,
        box: { x: boxLeft, y: boxTop[side], width, height }
    }
}
