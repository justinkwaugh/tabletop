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
