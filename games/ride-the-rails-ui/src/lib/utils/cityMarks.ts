import type { Point } from '@tabletop/common'
import type { CityId, RailroadId } from '@tabletop/ride-the-rails'
import { HEX_SIZE } from './boardGeometry.js'
import type { CityBonusMark } from './boardPieces.js'

// Art plan, City marks: every mark is placed from its hex's centre, in board units.

// The start band (BOARD_LOOK.startMark 'band').

/** The band of start colours just inside the hex's edge, measured across its sides. */
export const START_BAND_WIDTH = 6.4

/** A city where only Black may start (no printed colour, no cue) has a thin Black band. */
export const PLAIN_CITY_BAND_WIDTH = 2.4

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

/** The pill at the bottom centre of every city with a bonus, below its cubes, Chicago included. */
export const BONUS_PILL = {
    center: { x: 0, y: 26.6 },
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

/**
 * A green ring round a $5 city while its bonus is to be had, just outside the hex's edge and its
 * start band: a pointy hexagon whose inside lies on the hex edge, so it reaches 0 to 3.2 units
 * beyond it, where neither a lit ring nor a start cue (both inside the hex) can meet it.
 */
export const FIVE_RING = {
    radius: (HEX_SIZE * APOTHEM_RATIO + 3.2 / 2) / APOTHEM_RATIO,
    width: 3.2
} as const

export type FiveRing = { points: string; width: number }

/** R-4.3.2: the ring a $5 city wears until a railroad has had its bonus. */
export function fiveRing(bonus: CityBonusMark | undefined): FiveRing | undefined {
    if (bonus?.kind !== 'five' || bonus.taken) return undefined
    return {
        points: [0, 60, 120, 180, 240, 300]
            .map((degrees) => hexagonPoint(FIVE_RING.radius, degrees))
            .map(({ x, y }) => `${x},${y}`)
            .join(' '),
        width: FIVE_RING.width
    }
}

// The passenger (BOARD_LOOK.passenger 'meeple').

/**
 * Where a city's passenger stands from the hex's centre: up and right, inside the hex's top and
 * above the cubes, which keep their places in every hex, Chicago's too.
 */
const PASSENGER_OFFSET: Point = { x: 14.4, y: -23.8 }

/** The passenger's scale on the board, from its own units. */
export const PASSENGER_SCALE = 1.5

export function passengerOffset(_cityId: CityId): Point {
    return PASSENGER_OFFSET
}

/** A picked journey start lifts its passenger slightly, in the passenger's own units. */
export const PASSENGER_LIFT = 8

/** A picked journey start's passenger stands in the middle of its hex at this scale, over the cubes. */
export const START_PASSENGER_SCALE = 2.8

/**
 * Art plan, Passenger: a classic meeple in its own units, centred on the origin, one flat shape: a
 * round head, arms out and legs apart, in natural wood with a dark edge. About the pawn it
 * replaced in height (14.6) and at most a tenth wider (10.5 against 9.7), so it stands where the
 * pawn stood and clears the cubes, the "1" and the bonus pill alike.
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
    /** How far each arm reaches from the middle. */
    armReach: 4.9,
    /** The top of the gap between the legs, and the ground the feet stand on. */
    crotchY: 3.6,
    footY: 6.6,
    /** A taken passenger's dashed outline. */
    goneWidth: 0.8,
    goneDash: '1.5 1.1'
} as const

/** The meeple's extent in its own units, its edge included. */
export const MEEPLE_EXTENT = { left: -5.25, right: 5.25, top: -7.65, bottom: 6.95 } as const
