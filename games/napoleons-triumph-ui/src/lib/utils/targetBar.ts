import { APPROACH_GEOMETRY } from '$lib/map/boardGeometry.js'
import type { OrientedBox } from './orientedBox.js'

const TARGET_BAR_INSET = 14
const TARGET_BAR_HALF_WIDTH = 13

/** The bar a player taps to send pieces to an approach, lying just inside its locale. */
export function targetBarBox(approachId: number): OrientedBox {
    const bar = APPROACH_GEOMETRY[approachId]
    const radians = (bar.angle * Math.PI) / 180
    return {
        centre: {
            x: bar.centre.x + bar.inward.x * TARGET_BAR_INSET,
            y: bar.centre.y + bar.inward.y * TARGET_BAR_INSET
        },
        along: { x: Math.cos(radians), y: Math.sin(radians) },
        halfLength: bar.length / 2,
        halfWidth: TARGET_BAR_HALF_WIDTH
    }
}

/** How far into its locale, from the approach's line, the target bar reaches. */
export const TARGET_BAR_DEPTH = TARGET_BAR_INSET + TARGET_BAR_HALF_WIDTH
