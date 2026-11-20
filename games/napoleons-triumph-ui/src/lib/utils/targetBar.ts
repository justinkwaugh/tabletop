import { APPROACH_GEOMETRY } from '$lib/map/boardGeometry.js'
import type { OrientedBox } from './orientedBox.js'

const TARGET_BAR_INSET = 14
const TARGET_BAR_HALF_WIDTH = 13

/** A box the length of an approach's printed bar, moved inset from it into its locale. */
export function approachBarBox(approachId: number, halfWidth: number, inset = 0): OrientedBox {
    const bar = APPROACH_GEOMETRY[approachId]
    const radians = (bar.angle * Math.PI) / 180
    return {
        centre: {
            x: bar.centre.x + bar.inward.x * inset,
            y: bar.centre.y + bar.inward.y * inset
        },
        along: { x: Math.cos(radians), y: Math.sin(radians) },
        halfLength: bar.length / 2,
        halfWidth
    }
}

export function targetBarBox(approachId: number): OrientedBox {
    return approachBarBox(approachId, TARGET_BAR_HALF_WIDTH, TARGET_BAR_INSET)
}

export const TARGET_BAR_DEPTH = TARGET_BAR_INSET + TARGET_BAR_HALF_WIDTH
