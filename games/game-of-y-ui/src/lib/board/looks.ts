import { Color } from '@tabletop/common'
import type { StoneColor } from '@tabletop/game-of-y'
import { RISE, STONE_RADIUS, STONE_THICKNESS, TILT, type Box } from './geometry.js'

// 2.5 times the 2.5 px per unit the board fits at (GameTable's maxFitScale): larger images cost
// download and decoding for sharpness seen only at full zoom.
export const LOOK_PIXELS = 2.5 * 2.5

export const STONE_COLORS: readonly StoneColor[] = [Color.Black, Color.White]

// A stone's image, from its base's centre on the board: its rim's ellipse and its dome above.
export function stoneBox(pixels = LOOK_PIXELS, thickness = STONE_THICKNESS): Box {
    const r = STONE_RADIUS + 0.5
    const y = -r * TILT - thickness * RISE
    const box = { x: -r, y, width: 2 * r, height: r * TILT - y }
    return {
        ...box,
        width: Math.ceil(box.width * pixels) / pixels,
        height: Math.ceil(box.height * pixels) / pixels
    }
}

export function stoneLook(color: StoneColor): string {
    return `stone-${color}`
}

export const WOOD_LOOK = 'wood'
export const EDGE_LOOK = 'edge'
