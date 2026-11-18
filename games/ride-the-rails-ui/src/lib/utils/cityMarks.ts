import { assertExists, type Point } from '@tabletop/common'
import { cityById, type CityId, type HexId, type RailroadId } from '@tabletop/ride-the-rails'
import { HEX_SIZE, HEX_WIDTH, type BoardGeometry } from './boardGeometry.js'
import type { CityBonusMark } from './boardPieces.js'
import type { HexFrame } from './hexFrame.js'
import { HEX_LIMIT_MARK_AT, hexLimitMarks } from './terrainMarks.js'
import { highestCubeTop } from './trackLayout.js'

// Art plan, City marks: every mark is placed from its hex's centre, in board units, and turned to
// the way up its map's hexes stand (`hexFrame`).

// The start band (BOARD_LOOK.startMark 'band').

/** The band of start colours just inside the hex's edge, measured across its sides. */
export const START_BAND_WIDTH = 6.4

/** A city where only Black may start (no printed colour, no cue) has a thin Black band. */
export const PLAIN_CITY_BAND_WIDTH = 2.4

/** The pale line across the band where one colour meets the next. */
export const BAND_SEPARATOR_WIDTH = 1.6

const BLACK: RailroadId = 'railroad.black'

export type StartBand = { railroadIds: readonly RailroadId[]; width: number }

/**
 * R-4.2.5: Black may start in any city, so a city prints a start colour only where another
 * railroad may start there too. The USA's data leaves Black out of a plain city's colours, the
 * expansion maps' list it alone; either is a plain city.
 */
export function printsStartColours(startColours: readonly RailroadId[]): boolean {
    return startColours.some((railroadId) => railroadId !== BLACK)
}

/** R-4.2: the start colours printed on a city; a plain city shows Black alone (R-4.2.5). */
export function startBand(startColours: readonly RailroadId[]): StartBand {
    return printsStartColours(startColours)
        ? { railroadIds: startColours, width: START_BAND_WIDTH }
        : { railroadIds: [BLACK], width: PLAIN_CITY_BAND_WIDTH }
}

/**
 * A band segment's span in degrees, clockwise from the top of the hex: a pointy hex's top corner,
 * the middle of a flat hex's top edge.
 */
export type BandSpan = { from: number; to: number }

/**
 * Equal spans clockwise from the top, one per colour: two colours are the right half then the
 * left half. A single colour is the whole band.
 */
export function startBandSpans(count: number): BandSpan[] {
    const spans = Math.max(count, 1)
    const span = 360 / spans
    return Array.from({ length: spans }, (_, index) => ({
        from: index * span,
        to: (index + 1) * span
    }))
}

const SIDE_ANGLE = 60
const APOTHEM_RATIO = Math.cos(Math.PI / 6)

function round(value: number): number {
    return Math.round(value * 100) / 100 + 0
}

/** How far the frame's first corner stands clockwise from the top: 0 pointy, 30 flat. */
function firstCorner(frame: HexFrame): number {
    return frame.cornerAngles[0] ?? 0
}

/**
 * The point on the frame's hexagon of this corner radius at an angle clockwise from the top, its
 * centre at the origin.
 */
export function hexagonPoint(radius: number, degrees: number, frame: HexFrame): Point {
    const offset = firstCorner(frame)
    const side = Math.min(Math.floor((degrees - offset) / SIDE_ANGLE), 5)
    const fromSideMiddle =
        ((degrees - (offset + side * SIDE_ANGLE + SIDE_ANGLE / 2)) * Math.PI) / 180
    const reach = (radius * APOTHEM_RATIO) / Math.cos(fromSideMiddle)
    const radians = (degrees * Math.PI) / 180
    return { x: round(reach * Math.sin(radians)), y: round(-reach * Math.cos(radians)) }
}

function hexagonRun(radius: number, from: number, to: number, frame: HexFrame): Point[] {
    const offset = firstCorner(frame)
    const corners: Point[] = []
    for (
        let corner = Math.ceil((from - offset) / SIDE_ANGLE) * SIDE_ANGLE + offset;
        corner < to;
        corner += SIDE_ANGLE
    ) {
        if (corner > from) corners.push(hexagonPoint(radius, corner, frame))
    }
    return [hexagonPoint(radius, from, frame), ...corners, hexagonPoint(radius, to, frame)]
}

function pathOf(points: readonly Point[]): string {
    return `M${points.map((point) => `${point.x} ${point.y}`).join('L')}Z`
}

/** The corner radius of the band's inner edge, for a band this wide inside a hex. */
function innerRadius(width: number): number {
    return HEX_SIZE - width / APOTHEM_RATIO
}

/**
 * One closed path per span, round the hex's centre, between its edge and the band's inner edge;
 * a single span is the whole ring, filled even-odd.
 */
export function startBandPaths(
    spans: readonly BandSpan[],
    width: number,
    frame: HexFrame
): string[] {
    const inner = innerRadius(width)
    if (spans.length === 1) {
        // From the top round to the last corner; the path closes along the hex's top.
        const last = firstCorner(frame) + 300
        return [
            `${pathOf(hexagonRun(HEX_SIZE, 0, last, frame))}${pathOf(hexagonRun(inner, 0, last, frame))}`
        ]
    }
    return spans.map(({ from, to }) =>
        pathOf([
            ...hexagonRun(HEX_SIZE, from, to, frame),
            ...hexagonRun(inner, from, to, frame).reverse()
        ])
    )
}

/** A separator across the band where each span starts, when there are two or more. */
export function startBandSeparators(
    spans: readonly BandSpan[],
    width: number,
    frame: HexFrame
): string[] {
    if (spans.length < 2) return []
    const inner = innerRadius(width)
    return spans.map(({ from }) => {
        const outer = hexagonPoint(HEX_SIZE, from, frame)
        const end = hexagonPoint(inner, from, frame)
        return `M${outer.x} ${outer.y}L${end.x} ${end.y}`
    })
}

// The mountain's mark.

/** A small peak near the top of a mountain hex, its base the frame's `peakRise` above the centre. */
export const MOUNTAIN_PEAK = { path: 'M-9 0 L-3 -8 L1 -3 L4 -6 L9 0 Z', scale: 1.1 } as const

// The capacity marks.

/** A white outline of a cube, its side and gap from its city's hex edge in board units. */
export const CAPACITY_MARK = { side: 20, gap: 6, chicagoExtra: 16 } as const

export type CapacityMarkView = {
    /** The hex it limits: its city's own hex, or another hex that holds one locomotive (R-8). */
    hexId: HexId
    /** The city it limits, where the hex is a city's. */
    cityId: CityId | undefined
    text: string
    x: number
    y: number
    /** Drawn inside its hex (`HEX_LIMIT_MARK`), where no side opens on water. */
    inHex: boolean
}

/**
 * R-4.1.3, R-4.1.4, R-8: every limit printed on the map. Beside each city with a limit other than
 * two, the most locomotives it holds: 1 on the East Coast, and Chicago any number, so at most six,
 * one per railroad; then beside every other hex that holds one locomotive (Australia's
 * long-distance hexes, France's Paris entry hexes), a 1.
 *
 * Each mark stands in the water just past the first of its hex's sides, in the frame's order, with
 * no land beyond and a mark's gap clear of every mark placed before it (the cities in the map's
 * order, then the other hexes): its id's cell's sides first, then any other cell's (Berlin covers
 * two). A hex with no such side (Paris, Berlin, the Paris entry hexes), or a city its map's layout
 * names, has the mark inside the hex instead: a city's at the top left of its id's cell, another
 * hex's at its top centre (`hexLimitMarks`).
 */
export function capacityMarks(
    geometry: BoardGeometry,
    inHex: readonly CityId[] = []
): CapacityMarkView[] {
    const landCenters = geometry.hexIds.flatMap((hexId) =>
        geometry.place(hexId).cells.map((cell) => cell.center)
    )
    const isWater = (x: number, y: number) =>
        !landCenters.some((land) => Math.hypot(land.x - x, land.y - y) < HEX_SIZE / 2)
    const sides = geometry.hexFrame.capacitySides.map((degrees) => (degrees * Math.PI) / 180)
    const placed: Point[] = []
    const clearOfPlaced = (spot: Point) =>
        placed.every(
            (other) =>
                Math.max(Math.abs(other.x - spot.x), Math.abs(other.y - spot.y)) >=
                CAPACITY_MARK.side + CAPACITY_MARK.gap
        )
    const seaSpot = (hexId: HexId, text: string): Point | undefined => {
        // A 6 in the sea (Chicago's, Toronto's) stands further out, clear of the passenger's head,
        // which a city with no limit stands higher, above its top row of small cubes.
        const distance =
            HEX_WIDTH / 2 +
            CAPACITY_MARK.gap +
            CAPACITY_MARK.side / 2 +
            (text === '6' ? CAPACITY_MARK.chicagoExtra : 0)
        return geometry
            .place(hexId)
            .cells.flatMap(({ center }) => sides.map((angle) => ({ center, angle })))
            .filter(({ center, angle }) =>
                isWater(
                    center.x + Math.cos(angle) * HEX_WIDTH,
                    center.y + Math.sin(angle) * HEX_WIDTH
                )
            )
            .map(({ center, angle }) => ({
                x: center.x + Math.cos(angle) * distance,
                y: center.y + Math.sin(angle) * distance
            }))
            .find(clearOfPlaced)
    }
    const mark = (
        hexId: HexId,
        cityId: CityId | undefined,
        text: string,
        inside: Point
    ): CapacityMarkView => {
        const spot = cityId && inHex.includes(cityId) ? undefined : seaSpot(hexId, text)
        if (spot) placed.push(spot)
        const { x, y } = spot ?? inside
        return { hexId, cityId, text, x, y, inHex: !spot }
    }
    const cityMarks = geometry.map.cities.flatMap((city): CapacityMarkView[] => {
        const text = city.capacity === 1 ? '1' : city.capacity === 'unlimited' ? '6' : undefined
        if (text === undefined) return []
        const own = geometry.place(city.hexId).cells[0]?.center
        assertExists(own, `${city.id} covers no cell`)
        return [
            mark(city.hexId, city.id, text, {
                x: own.x + HEX_LIMIT_MARK_AT.city.x,
                y: own.y + HEX_LIMIT_MARK_AT.city.y
            })
        ]
    })
    const hexMarks = hexLimitMarks(geometry).map((inside) =>
        mark(inside.hexId, undefined, inside.text, inside)
    )
    return [...cityMarks, ...hexMarks]
}

// The bonus pill (BOARD_LOOK.bonus 'pill').

/**
 * The pill at the bottom centre of every city with a bonus, below its cubes, Chicago included; its
 * middle is the frame's `bonusPill`.
 */
export const BONUS_PILL = {
    width: 26,
    height: 16.8,
    strokeWidth: 1.6,
    fontSize: 12.8,
    /** A used-up $5 is struck through, relative to the pill's centre. */
    strike: { from: { x: -11, y: 6 }, to: { x: 11, y: -6 }, width: 2.2 }
} as const

export type BonusPill = {
    text: string
    fill: string
    ink: string
    /** A $5 a railroad has had: greyed and struck through. */
    used: boolean
    /** Wider than the usual pill for an amount of more than two characters. */
    width: number
}

/** Each character past the second widens the pill by one figure; Toronto's slash a little more. */
const PILL_FIGURE = 8.3
const PILL_SLASH = 3

function pillWidth(text: string): number {
    const figures = text.replace('/', '').length
    const widened =
        BONUS_PILL.width +
        Math.max(0, figures - 2) * PILL_FIGURE +
        (text.includes('/') ? PILL_SLASH : 0)
    return Math.round(widened * 10) / 10
}

/**
 * R-4.3.1, R-4.3.2, R-8: a gold pill pays every placement (Chicago's $2, each expansion city's,
 * Toronto's two prices in one); a green $5 only the first.
 */
export function bonusPill(bonus: CityBonusMark): BonusPill {
    if (bonus.kind === 'coin') {
        const { text } = bonus
        return {
            text,
            fill: 'var(--rtr-coin)',
            ink: 'var(--rtr-coin-ink)',
            used: false,
            width: pillWidth(text)
        }
    }
    const text = `$${bonus.amount}`
    const width = pillWidth(text)
    return bonus.taken
        ? { text, fill: 'var(--rtr-coin-used)', ink: 'var(--rtr-coin-used-ink)', used: true, width }
        : { text, fill: 'var(--rtr-five)', ink: 'var(--rtr-five-ink)', used: false, width }
}

/**
 * A green ring round a $5 city while its bonus is to be had, just outside the hex's edge and its
 * start band: a hexagon whose inside lies on the hex edge, so it reaches 0 to 3.2 units
 * beyond it, where neither a lit ring nor a start cue (both inside the hex) can meet it.
 */
export const FIVE_RING = {
    radius: (HEX_SIZE * APOTHEM_RATIO + 3.2 / 2) / APOTHEM_RATIO,
    width: 3.2
} as const

export type FiveRing = { points: string; width: number }

/** R-4.3.2: the ring a $5 city wears until a railroad has had its bonus. */
export function fiveRing(bonus: CityBonusMark | undefined, frame: HexFrame): FiveRing | undefined {
    if (bonus?.kind !== 'five' || bonus.taken) return undefined
    return {
        points: frame.cornerAngles
            .map((degrees) => hexagonPoint(FIVE_RING.radius, degrees, frame))
            .map(({ x, y }) => `${x},${y}`)
            .join(' '),
        width: FIVE_RING.width
    }
}

// The passenger (BOARD_LOOK.passenger 'meeple').

/** The passenger's scale on the board, from its own units, large enough to see across the map. */
export const PASSENGER_SCALE = 2.4

/** How far a passenger's feet, their edge included, stand above the highest cube its hex can hold. */
const PASSENGER_CUBE_CLEARANCE = 1

/**
 * The line a city's passenger stands on from its hex's centre, its feet's edge included: just above
 * the top of the highest cube the city can ever hold (`highestCubeTop`), so no cube covers it. The
 * figure is taller than the room above the cubes, so its head stands in the hex above, over that
 * hex's cubes where it reaches them (Board.svelte draws the passengers after the cubes). Every city
 * stands it on the same line, 12.5 above the centre, either way up, but those with no limit, whose
 * top row of small cubes reaches higher: Chicago 17, Paris and Toronto 18.5.
 */
export function passengerFeet(cityId: CityId): number {
    return highestCubeTop(cityById(cityId).hexId) - PASSENGER_CUBE_CLEARANCE
}

/** How far right of its hex's centre a passenger stands, over the right-hand cube's place. */
const PASSENGER_OFFSET_X = 14.4

/** Where a city's passenger stands from its hex's centre: right of the middle, on its feet's line. */
export function passengerOffset(cityId: CityId): Point {
    return {
        x: PASSENGER_OFFSET_X,
        y: passengerFeet(cityId) - MEEPLE_EXTENT.bottom * PASSENGER_SCALE
    }
}

/** A picked journey start lifts its passenger slightly, in the passenger's own units. */
export const PASSENGER_LIFT = 8

/** A picked journey start's passenger stands in the middle of its hex at this scale, over the cubes. */
export const START_PASSENGER_SCALE = 2.8

/**
 * Art plan, Passenger: a classic meeple in its own units, centred on the origin, one flat shape: a
 * round head, arms out and legs apart, in natural wood with a dark edge. About the pawn it
 * replaced in height (14.6) and at most a tenth wider (10.5 against 9.7). It stands above the cubes,
 * well clear of the bonus pill below them.
 */
export const MEEPLE = {
    path:
        'M-1.3 -2.88 A2.4 2.4 0 1 1 1.3 -2.88 C2.6 -2.5 4.9 -2.3 4.9 -1 ' +
        'C4.9 -0.1 4.3 0.3 3.4 0.3 L2.3 0.4 L3.4 5.9 C3.6 6.5 3.3 6.6 2.9 6.6 ' +
        'L1 6.6 L0 3.6 L-1 6.6 L-2.9 6.6 C-3.3 6.6 -3.6 6.5 -3.4 5.9 L-2.3 0.4 ' +
        'L-3.4 0.3 C-4.3 0.3 -4.9 -0.1 -4.9 -1 C-4.9 -2.3 -2.6 -2.5 -1.3 -2.88 Z',
    edgeWidth: 0.7,
    /** The head, the part a cube in front of the meeple could hide. */
    head: { cx: 0, cy: -4.9, r: 2.4 },
    /** How far each arm reaches from the middle, and the arms' underside where they meet the body. */
    armReach: 4.9,
    armBottomY: 0.4,
    /** The top of the gap between the legs, and the ground the feet stand on. */
    crotchY: 3.6,
    footY: 6.6,
    /** A taken passenger's dashed outline. */
    goneWidth: 0.8,
    goneDash: '1.5 1.1'
} as const

/** The meeple's extent in its own units, its edge included. */
export const MEEPLE_EXTENT = { left: -5.25, right: 5.25, top: -7.65, bottom: 6.95 } as const
