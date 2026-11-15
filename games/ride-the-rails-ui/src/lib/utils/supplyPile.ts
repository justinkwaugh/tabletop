import type { Point, RectangleDimensions } from '@tabletop/common'
import { LOCOMOTIVES_PER_RAILROAD } from '@tabletop/ride-the-rails'

/**
 * Art plan, Supply pile: a railroad's locomotives still off the map (R-1.1-H1), drawn as the cubes
 * themselves with no number, in columns of five, each filling from the front (bottom) row. Sizes
 * are pile units.
 *
 * - `fixed`: the box holds a full supply, so the pile never moves as it shrinks (desktop cards).
 * - `follow`: the box follows the count, so a column goes as it empties (the action panel's piles).
 */
export type PileFit = 'fixed' | 'follow'

/** Each cube: the map's flat square, smaller, with a thinner edge. */
export const PILE_CUBE = { side: 9.2, edge: 0.6 } as const

const GROUP = 5
const PITCH = { across: 11, down: 10.4 } as const
/** The extra space after every second column. */
const PAIR_GAP = 3.5

/** Room round the cubes for their edge. */
export const PILE_PAD = 0.5

/** Where the `index`th column starts: a pitch a step, and the gap after every second. */
function offset(index: number): number {
    return index * PITCH.across + Math.floor(index / 2) * PAIR_GAP
}

/** The cubes' centres, in pile units, back to front (top row first), so the front ones draw last. */
export function pileCubes(count: number): Point[] {
    const inset = PILE_PAD + PILE_CUBE.side / 2
    const cubes = Array.from({ length: count }, (_, index): Point => {
        const column = Math.floor(index / GROUP)
        const row = GROUP - 1 - (index % GROUP)
        return { x: inset + offset(column), y: inset + row * PITCH.down }
    })
    return cubes.sort((a, b) => a.y - b.y || a.x - b.x)
}

/** One column's box: a cube and its edge room across, five rows down. */
const COLUMN: RectangleDimensions = {
    width: PILE_CUBE.side + 2 * PILE_PAD,
    height: (GROUP - 1) * PITCH.down + PILE_CUBE.side + 2 * PILE_PAD
}

/**
 * A pile's box, in pile units: always five rows high; as wide as a full supply when fixed, or as
 * its columns when following. An empty supply keeps one column, for its dashed ghost.
 */
export function pileFootprint(fit: PileFit, count: number): RectangleDimensions {
    const shown = fit === 'fixed' ? LOCOMOTIVES_PER_RAILROAD : count
    const columns = Math.max(1, Math.ceil(shown / GROUP))
    return { width: COLUMN.width + offset(columns - 1), height: COLUMN.height }
}

/** An empty supply's ghost column: dashed in the railroad's colour, inside the column's box. */
export const PILE_GHOST = {
    x: PILE_PAD,
    y: PILE_PAD,
    width: PILE_CUBE.side,
    height: COLUMN.height - 2 * PILE_PAD,
    stroke: 1,
    dash: '2.4 1.8',
    opacity: 0.7
} as const

/**
 * Screen pixels a pile unit on a desktop card, one scale for the cubes and the gaps between them:
 * a full pile as tall as the 64 px card's room for it, 56 px (a cube about 9.9 px).
 */
export const CARD_PILE_UNIT = 56 / COLUMN.height

/** How a row of piles is laid out: each pile's chrome and least width in px, and the gap between. */
export type PileRow = { maxUnit: number; chrome: number; minWidth: number; gap: number }

/**
 * Take a share's buttons on a phone: padding 5 a side and a 1.5 px border, at least 40 px wide,
 * 5 px apart, the cubes at most 1.1 px a unit (10 px).
 */
export const SHARE_BUTTON_ROW: PileRow = {
    maxUnit: 1.1,
    chrome: 2 * 5 + 2 * 1.5,
    minWidth: 40,
    gap: 5
}

/** The phone build panel's piles: padding 3 and a 1 px rule a side, 4 px apart, at most 0.62. */
export const BUILD_PILE_ROW: PileRow = { maxUnit: 0.62, chrome: 2 * 3 + 2 * 1, minWidth: 0, gap: 4 }

/** The room the phone build panel keeps for its piles, between the count and the button. */
export const BUILD_PILE_ROOM = 160

/** A row's width in px with its piles (widths in pile units) drawn at `unit`. */
export function rowWidth(widths: readonly number[], unit: number, row: PileRow): number {
    const piles = widths.reduce(
        (sum, width) => sum + Math.max(row.minWidth, width * unit + row.chrome),
        0
    )
    return piles + row.gap * Math.max(0, widths.length - 1)
}

/**
 * The largest pile unit, up to the row's most, at which every pile fits `room` px; the most while
 * the room is not yet measured. Found to a thousandth.
 */
export function fittedPileUnit(widths: readonly number[], room: number, row: PileRow): number {
    if (room <= 0 || rowWidth(widths, row.maxUnit, row) <= room) return row.maxUnit
    let low = 0
    let high = row.maxUnit
    while (high - low > 0.0005) {
        const middle = (low + high) / 2
        if (rowWidth(widths, middle, row) <= room) low = middle
        else high = middle
    }
    return Math.floor(low * 1000) / 1000
}
