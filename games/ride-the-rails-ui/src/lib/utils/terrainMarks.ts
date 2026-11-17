import type { Point } from '@tabletop/common'
import type { HexId } from '@tabletop/ride-the-rails'
import type { BoardGeometry } from './boardGeometry.js'

// Art plan, Expansion boards: the marks the expansion maps' boards add inside their hexes, in board
// units from a hex's centre, each drawn as plain shapes (no filter, mask or pattern).

/**
 * A limit inside a hex: an inked outline of a cube with the most locomotives the hex holds, on a
 * pale ground, so it reads on any fill.
 */
export const HEX_LIMIT_MARK = {
    side: 15,
    radius: 2.2,
    strokeWidth: 1.6,
    fontSize: 11.5,
    /** The number's baseline below the mark's centre. */
    baseline: 4.1,
    groundOpacity: 0.75
} as const

/** Where an in-hex limit mark stands: the top centre of a plain hex, the top left of a city's. */
export const HEX_LIMIT_MARK_AT = {
    plain: { x: 0, y: -22 },
    city: { x: -14.4, y: -21 }
} as const

export type HexLimitMarkView = { hexId: HexId; text: string; x: number; y: number }

/**
 * R-8: every hex other than a city that holds one locomotive, a long-distance hex (Australia) or a
 * Paris entry hex (France), carries a 1 at its top centre.
 */
export function hexLimitMarks(geometry: BoardGeometry): HexLimitMarkView[] {
    return geometry.map.hexes.flatMap((hex) => {
        if (hex.terrain === 'city' || geometry.map.capacity(hex.id) !== 1) return []
        const center = geometry.place(hex.id).center
        return [
            {
                hexId: hex.id,
                text: '1',
                x: center.x + HEX_LIMIT_MARK_AT.plain.x,
                y: center.y + HEX_LIMIT_MARK_AT.plain.y
            }
        ]
    })
}

/**
 * R-8.2: the Alps' hatch over their mountain fill, the sea's 45° lines (7 apart, on the sea's own
 * lattice) a little heavier, in the peak's brown.
 */
export const ALPS_HATCH = { spacing: 7, width: 2.2 } as const

function pointText({ x, y }: Point): string {
    return `${x.toFixed(1)} ${y.toFixed(1)}`
}

/**
 * Where the line x + y = `offset` crosses a convex cell: the two points it enters and leaves by,
 * or none where it only touches a corner or misses.
 */
function crossing(corners: readonly Point[], offset: number): [Point, Point] | undefined {
    const points: Point[] = []
    corners.forEach((from, index) => {
        const to = corners[(index + 1) % corners.length]
        if (!to) return
        const a = from.x + from.y - offset
        const b = to.x + to.y - offset
        if (a === b || a * b > 0 || (b === 0 && a !== 0)) return
        const t = a / (a - b)
        points.push({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t })
    })
    if (points.length < 2) return undefined
    const sorted = points.toSorted((p, q) => q.x - p.x)
    const first = sorted[0]
    const last = sorted.at(-1)
    if (!first || !last || Math.hypot(first.x - last.x, first.y - last.y) < 0.5) return undefined
    return [first, last]
}

/**
 * The Alps' hatch as one path of drawn lines, each cut to the Alps cell it crosses, running down
 * to the left as the sea's do: no pattern and no clip, so it costs what the sea's hatch costs.
 */
export function alpsHatchPath(geometry: BoardGeometry): string {
    const step = ALPS_HATCH.spacing * Math.SQRT2
    const segments: string[] = []
    for (const hex of geometry.map.hexes) {
        if (hex.terrain !== 'alps') continue
        for (const cell of geometry.place(hex.id).cells) {
            const sums = cell.vertices.map((corner) => corner.x + corner.y)
            const first = Math.ceil(Math.min(...sums) / step)
            const last = Math.floor(Math.max(...sums) / step)
            for (let line = first; line <= last; line++) {
                const ends = crossing(cell.vertices, line * step)
                if (ends) segments.push(`M${pointText(ends[0])}L${pointText(ends[1])}`)
            }
        }
    }
    return segments.join('')
}

/**
 * R-8.2: a long-distance hex's hourglass, the turn ending there, at the bottom of the hex below
 * its 1: an inked frame round a pale glass, sand in its lower bulb. In its own units round its
 * middle, `half` its reach each way.
 */
export const HOURGLASS = {
    at: { x: 0, y: 24 },
    half: { x: 5.9, y: 7.9 },
    frame: 'M-5 -7H5M-5 7H5',
    frameWidth: 1.8,
    glass: 'M-3.8 -6.2H3.8L0.9 0L3.8 6.2H-3.8L-0.9 0Z',
    glassWidth: 1.3,
    glassOpacity: 0.8,
    sand: 'M-2.2 5.2H2.2L0 2.6Z'
} as const
