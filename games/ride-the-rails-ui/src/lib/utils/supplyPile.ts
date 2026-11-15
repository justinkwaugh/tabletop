import type { Point, RectangleDimensions } from '@tabletop/common'
import { LOCOMOTIVES_PER_RAILROAD } from '@tabletop/ride-the-rails'

/**
 * Art plan, Supply pile: a railroad's locomotives still off the map (R-1.1-H1), drawn as the cubes
 * themselves with no number. Desktop cards stand them in columns of five, each filling from the
 * front (bottom) row; the phone rail lays the same groups of five as rows. Sizes are pile units.
 */
export type PileArrangement = 'columns' | 'rows'

/** Each cube: the map's flat square, smaller, with a thinner edge. */
export const PILE_CUBE = { side: 9.2, edge: 0.6 } as const

const GROUP = 5
const PITCH = { across: 11, down: 10.4 } as const
/** The extra space after every second column (desktop) or row (rail). */
const PAIR_GAP: Readonly<Record<PileArrangement, number>> = { columns: 3.5, rows: 3 }

/** Room round the cubes for their edge. */
export const PILE_PAD = 0.5

/** Screen pixels a pile unit: a desktop card's cube is 7.5 px, a rail's 8.6 px. */
export const PILE_PIXELS_PER_UNIT: Readonly<Record<PileArrangement, number>> = {
    columns: 0.82,
    rows: 0.93
}

/** Where the `index`th column or row starts: a pitch a step, and the gap after every second. */
function offset(index: number, pitch: number, gap: number): number {
    return index * pitch + Math.floor(index / 2) * gap
}

/** The cubes' centres, in pile units, back to front (top row first), so the front ones draw last. */
export function pileCubes(count: number, arrangement: PileArrangement): Point[] {
    const inset = PILE_PAD + PILE_CUBE.side / 2
    const cubes = Array.from({ length: count }, (_, index): Point => {
        if (arrangement === 'columns') {
            const column = Math.floor(index / GROUP)
            const row = GROUP - 1 - (index % GROUP)
            return {
                x: inset + offset(column, PITCH.across, PAIR_GAP.columns),
                y: inset + row * PITCH.down
            }
        }
        const row = Math.floor(index / GROUP)
        const column = index % GROUP
        return {
            x: inset + column * PITCH.across,
            y: inset + offset(row, PITCH.down, PAIR_GAP.rows)
        }
    })
    return cubes.sort((a, b) => a.y - b.y || a.x - b.x)
}

/** A pile's box, in pile units: always room for a full supply, so a pile never moves as it shrinks. */
export function pileFootprint(arrangement: PileArrangement): RectangleDimensions {
    const cubes = pileCubes(LOCOMOTIVES_PER_RAILROAD, arrangement)
    const reach = (pick: (cube: Point) => number) =>
        Math.max(...cubes.map(pick)) + PILE_CUBE.side / 2 + PILE_PAD
    return { width: reach((cube) => cube.x), height: reach((cube) => cube.y) }
}
