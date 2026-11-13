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
export const BOARD_MARGIN = HEX_SIZE

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

type Side = { from: Point; to: Point }

function hexSides(hexId: HexId): Side[] {
    const corners = hexCorners(hexId)
    return corners.map((from, index) => ({ from, to: corners[(index + 1) % corners.length] }))
}

// R-4.1.2: the board is the hex set, so its coast is every hex side no other hex shares.
function coastLoops(): Point[][] {
    const sides = USA_HEXES.flatMap((hex) => hexSides(hex.id))
    const sideKeys = new Set(sides.map((side) => `${pointText(side.from)}>${pointText(side.to)}`))
    const coastSides = new Map(
        sides
            .filter((side) => !sideKeys.has(`${pointText(side.to)}>${pointText(side.from)}`))
            .map((side) => [pointText(side.from), side])
    )
    const loops: Point[][] = []
    while (coastSides.size > 0) {
        const [firstKey] = coastSides.keys()
        const loop: Point[] = []
        let key = firstKey
        for (let side = coastSides.get(key); side; side = coastSides.get(key)) {
            coastSides.delete(key)
            loop.push(side.from)
            key = pointText(side.to)
        }
        loops.push(loop)
    }
    return loops
}

export const COAST_LOOPS: readonly (readonly Point[])[] = coastLoops()

export const COAST_PATH = COAST_LOOPS.map(closedPath).join('')

export type Station = Point & { radius: number }

const STATION_RADIUS = 12
const STATION_RISE = 8
const CHICAGO_STATION_RADIUS = 10

// R-4.1.4: Chicago has no capacity limit, so its station sits centred between two rows of track.
export function stationOf(cityId: CityId): Station {
    const city = usaCity(cityId)
    const center = hexCenter(city.hexId)
    return city.capacity === 'unlimited'
        ? { ...center, radius: CHICAGO_STATION_RADIUS }
        : { x: center.x, y: center.y - STATION_RISE, radius: STATION_RADIUS }
}

/** The board a 1280 × 900 desktop window leaves for the map beside the sidebar, under the turn header and action area. */
export const DESKTOP_BOARD_VIEW: RectangleDimensions = { width: 940, height: 640 }

export const FITTED_DESKTOP_SCALE = Math.min(
    DESKTOP_BOARD_VIEW.width / BOARD_WIDTH,
    DESKTOP_BOARD_VIEW.height / BOARD_HEIGHT,
    1
)

export const SEAT_INITIALS_MIN_SCALE = 0.3

export function drawsSeatInitials(viewScale: number): boolean {
    return viewScale >= SEAT_INITIALS_MIN_SCALE
}

const CITY_LABEL_SCREEN_SIZE = 10

/** City names keep their screen size as the view zooms in, and stop growing on the board below the fitted desktop scale. */
export function cityLabelFontSize(viewScale: number): number {
    return CITY_LABEL_SCREEN_SIZE / Math.max(viewScale, FITTED_DESKTOP_SCALE)
}

export const LARGEST_CITY_LABEL_FONT_SIZE = cityLabelFontSize(FITTED_DESKTOP_SCALE)

/** Contract, Phone layout: a phone's whole map would draw names about 4 px high, so it leaves them off; a press shows the city. */
export const MIN_CITY_LABEL_SCREEN_SIZE = 6

export function drawsCityLabels(viewScale: number): boolean {
    return cityLabelFontSize(viewScale) * viewScale >= MIN_CITY_LABEL_SCREEN_SIZE
}

export type LabelSide = 'above' | 'below' | 'left' | 'right'

const CITY_LABEL_SIDES: ReadonlyMap<CityId, LabelSide> = new Map<CityId, LabelSide>([
    ['city.usa.seattle', 'below'],
    ['city.usa.spokane', 'below'],
    ['city.usa.billings', 'below'],
    ['city.usa.fargo', 'below'],
    ['city.usa.butte', 'below'],
    ['city.usa.bismarck', 'below'],
    ['city.usa.green-bay', 'below'],
    ['city.usa.portland-or', 'right'],
    ['city.usa.minneapolis', 'below'],
    ['city.usa.portland-me', 'left'],
    ['city.usa.rapid-city', 'below'],
    ['city.usa.milwaukee', 'below'],
    ['city.usa.boise', 'below'],
    ['city.usa.pocatello', 'below'],
    ['city.usa.detroit', 'below'],
    ['city.usa.buffalo', 'below'],
    ['city.usa.albany', 'below'],
    ['city.usa.boston', 'below'],
    ['city.usa.cheyenne', 'below'],
    ['city.usa.omaha', 'below'],
    ['city.usa.des-moines', 'below'],
    ['city.usa.chicago', 'below'],
    ['city.usa.salt-lake-city', 'below'],
    ['city.usa.new-york', 'below'],
    ['city.usa.reno', 'below'],
    ['city.usa.pittsburgh', 'below'],
    ['city.usa.philadelphia', 'below'],
    ['city.usa.denver', 'below'],
    ['city.usa.kansas-city', 'below'],
    ['city.usa.saint-louis', 'below'],
    ['city.usa.cincinnati', 'below'],
    ['city.usa.san-francisco', 'below'],
    ['city.usa.baltimore', 'below'],
    ['city.usa.las-vegas', 'below'],
    ['city.usa.oklahoma-city', 'below'],
    ['city.usa.nashville', 'below'],
    ['city.usa.santa-fe', 'below'],
    ['city.usa.little-rock', 'below'],
    ['city.usa.washington', 'above'],
    ['city.usa.los-angeles', 'below'],
    ['city.usa.atlanta', 'below'],
    ['city.usa.charleston', 'above'],
    ['city.usa.phoenix', 'below'],
    ['city.usa.dallas', 'below'],
    ['city.usa.el-paso', 'below'],
    ['city.usa.jacksonville', 'below'],
    ['city.usa.houston', 'below'],
    ['city.usa.new-orleans', 'below'],
    ['city.usa.tampa', 'below'],
    ['city.usa.corpus-christi', 'below'],
    ['city.usa.miami', 'below']
])

export function cityLabelSide(cityId: CityId): LabelSide {
    const side = CITY_LABEL_SIDES.get(cityId)
    assertExists(side, `No label side for city ${cityId}`)
    return side
}

export type CityLabel = Point & {
    textAnchor: 'start' | 'middle' | 'end'
    fontSize: number
    /** The room the name is given on the board, estimated from its length: nothing is measured at run time. */
    box: BoundingBox
}

const LABEL_GAP = 3
const LABEL_ABOVE_REACH = STATION_RISE + STATION_RADIUS + LABEL_GAP
const LABEL_BELOW_REACH = 24
const LABEL_SIDE_REACH = HEX_WIDTH / 2
const CHARACTER_WIDTH_EM = 0.6
const LABEL_HEIGHT_EM = 1.2
const BASELINE_EM = 0.95

export function cityLabel(
    cityId: CityId,
    fontSize: number = LARGEST_CITY_LABEL_FONT_SIZE
): CityLabel {
    return labelOn(cityId, cityLabelSide(cityId), fontSize)
}

function labelOn(cityId: CityId, side: LabelSide, fontSize: number): CityLabel {
    const city = usaCity(cityId)
    const center = hexCenter(city.hexId)
    const station = stationOf(cityId)
    const width = city.name.length * CHARACTER_WIDTH_EM * fontSize
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

export type MarginBox = 'roundTrack' | 'turnOrder' | 'railroadStrip' | 'transcontinental'

/** Desktop only: the Pacific below the West's lower rows and the Atlantic below the East Coast. */
export const MARGIN_BOXES: Readonly<Record<MarginBox, BoundingBox>> = {
    roundTrack: { x: 16, y: 972, width: 520, height: 112 },
    turnOrder: { x: 16, y: 1100, width: 520, height: 124 },
    transcontinental: { x: 2000, y: 560, width: 246, height: 220 },
    railroadStrip: { x: 1824, y: 800, width: 422, height: 424 }
}
