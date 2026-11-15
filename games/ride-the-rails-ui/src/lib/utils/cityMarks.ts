import type { Point } from '@tabletop/common'
import { usaCity, type CityId, type RailroadId } from '@tabletop/ride-the-rails'
import { HEX_SIZE } from './boardGeometry.js'
import type { CityBonusMark } from './boardPieces.js'

// Art plan, City marks: every mark is placed from its hex's centre, in board units.

function hasNoLimit(cityId: CityId): boolean {
    return usaCity(cityId).capacity === 'unlimited'
}

// The start band (BOARD_LOOK.startMark 'band').

/** The band of start colours just inside the hex's edge, measured across its sides. */
export const START_BAND_WIDTH = 6.4

/** A city with no printed start colour, where only Black may start, has a thinner Black band. */
export const PLAIN_CITY_BAND_WIDTH = 5.2

/** The pale line across the band where one colour meets the next. */
export const BAND_SEPARATOR_WIDTH = 1.6

const BLACK: RailroadId = 'railroad.black'

export type StartBand = { railroadIds: readonly RailroadId[]; width: number }

/** R-4.2: the start colours printed on a city; a plain city shows Black alone (R-4.2.5). */
export function startBand(startColours: readonly RailroadId[]): StartBand {
    return startColours.length > 0
        ? { railroadIds: startColours, width: START_BAND_WIDTH }
        : { railroadIds: [BLACK], width: PLAIN_CITY_BAND_WIDTH }
}

/** A band segment's span in degrees, clockwise from the hex's top corner. */
export type BandSpan = { from: number; to: number }

/**
 * Equal spans clockwise from the top corner, one per colour: two colours are the right half then
 * the left half. A single colour is the whole band.
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

/** The point on a pointy-topped hexagon of this corner radius at an angle clockwise from the top. */
export function hexagonPoint(radius: number, degrees: number): Point {
    const side = Math.min(Math.floor(degrees / SIDE_ANGLE), 5)
    const fromSideMiddle = ((degrees - (side * SIDE_ANGLE + SIDE_ANGLE / 2)) * Math.PI) / 180
    const reach = (radius * APOTHEM_RATIO) / Math.cos(fromSideMiddle)
    const radians = (degrees * Math.PI) / 180
    return { x: round(reach * Math.sin(radians)), y: round(-reach * Math.cos(radians)) }
}

function hexagonRun(radius: number, from: number, to: number): Point[] {
    const corners: Point[] = []
    for (
        let corner = Math.ceil(from / SIDE_ANGLE) * SIDE_ANGLE;
        corner < to;
        corner += SIDE_ANGLE
    ) {
        if (corner > from) corners.push(hexagonPoint(radius, corner))
    }
    return [hexagonPoint(radius, from), ...corners, hexagonPoint(radius, to)]
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
export function startBandPaths(spans: readonly BandSpan[], width: number): string[] {
    const inner = innerRadius(width)
    if (spans.length === 1) {
        return [`${pathOf(hexagonRun(HEX_SIZE, 0, 300))}${pathOf(hexagonRun(inner, 0, 300))}`]
    }
    return spans.map(({ from, to }) =>
        pathOf([...hexagonRun(HEX_SIZE, from, to), ...hexagonRun(inner, from, to).reverse()])
    )
}

/** A separator across the band where each span starts, when there are two or more. */
export function startBandSeparators(spans: readonly BandSpan[], width: number): string[] {
    if (spans.length < 2) return []
    const inner = innerRadius(width)
    return spans.map(({ from }) => {
        const outer = hexagonPoint(HEX_SIZE, from)
        const end = hexagonPoint(inner, from)
        return `M${outer.x} ${outer.y}L${end.x} ${end.y}`
    })
}

// The bonus pill (BOARD_LOOK.bonus 'pill').

/** The pill up and left of the hex's centre in every city with a bonus, Chicago included. */
export const BONUS_PILL = {
    center: { x: -16.8, y: -20.8 },
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
}

/** R-4.3.1, R-4.3.2: Chicago's gold $2 pays every placement; a green $5 only the first. */
export function bonusPill(bonus: CityBonusMark): BonusPill {
    const text = `$${bonus.amount}`
    if (bonus.kind === 'chicago') {
        return { text, fill: 'var(--rtr-coin)', ink: 'var(--rtr-coin-ink)', used: false }
    }
    return bonus.taken
        ? { text, fill: 'var(--rtr-coin-used)', ink: 'var(--rtr-coin-used-ink)', used: true }
        : { text, fill: 'var(--rtr-five)', ink: 'var(--rtr-five-ink)', used: false }
}

/** R-4.1.4: an East Coast city's capacity, a "1" above its one cube. */
export const CAPACITY_ONE = { x: 0, y: -22.4, fontSize: 16 } as const

// The passenger (BOARD_LOOK.passenger 'pawn').

/**
 * Where a city's passenger stands from the hex's centre: up and right, clear of the bonus pill;
 * Chicago's higher, clear of its back row of cubes.
 */
const PASSENGER_OFFSET: Point = { x: 18.4, y: -18.4 }
const CHICAGO_PASSENGER_OFFSET: Point = { x: 21.2, y: -22 }

/** The passenger's scale on the board, from its own units. */
export const PASSENGER_SCALE = 2.1

export function passengerOffset(cityId: CityId): Point {
    return hasNoLimit(cityId) ? CHICAGO_PASSENGER_OFFSET : PASSENGER_OFFSET
}

/** A picked journey start lifts its passenger slightly, in the passenger's own units. */
export const PASSENGER_LIFT = 8

/**
 * Art plan, Passenger: a pawn in its own units, centred on the origin, one flat shape: a head, a
 * collar, a flared stem and a base, in natural wood with a dark edge.
 */
export const PAWN = {
    path:
        'M-1.5 -2.68 A2.6 2.6 0 1 1 1.5 -2.68 L1.5 -2.4 L3 -2.4 L3 -0.9 L1.5 -0.9 ' +
        'C1.5 1.6 2.7 3.1 3.7 4 L4.5 4 L4.5 6.5 L-4.5 6.5 L-4.5 4 L-3.7 4 ' +
        'C-2.7 3.1 -1.5 1.6 -1.5 -0.9 L-3 -0.9 L-3 -2.4 L-1.5 -2.4 Z',
    edgeWidth: 0.7,
    /** The head, the part a cube in front of the pawn could hide. */
    head: { cx: 0, cy: -4.8, r: 2.6 },
    /** A taken passenger's dashed outline. */
    goneWidth: 0.8,
    goneDash: '1.5 1.1'
} as const

/** The pawn's extent in its own units, its edge included. */
export const PAWN_EXTENT = { left: -4.85, right: 4.85, top: -7.75, bottom: 6.85 } as const
