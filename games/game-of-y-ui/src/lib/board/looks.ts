import { Color } from '@tabletop/common'
import type { StoneColor } from '@tabletop/game-of-y'
import { riseOf, STONE_RADIUS, STONE_THICKNESS, type Box } from './geometry.js'

// 2.5 times the 2.5 px per unit the board fits at (GameTable's maxFitScale): larger images cost
// download and decoding for sharpness seen only at full zoom.
export const LOOK_PIXELS = 2.5 * 2.5

export const STONE_COLORS: readonly StoneColor[] = [Color.Black, Color.White]

// A stone's image seen at `tilt`, from its base's centre on the board: its rim's ellipse and its
// dome above.
export function stoneBox(tilt: number, pixels = LOOK_PIXELS, thickness = STONE_THICKNESS): Box {
    const r = STONE_RADIUS + 0.5
    const y = -r * tilt - thickness * riseOf(tilt)
    const box = { x: -r, y, width: 2 * r, height: r * tilt - y }
    return {
        ...box,
        width: Math.ceil(box.width * pixels) / pixels,
        height: Math.ceil(box.height * pixels) / pixels
    }
}

export function stoneLook(color: StoneColor, flat: boolean): string {
    return flat ? `stone-${color}-flat` : `stone-${color}`
}

export function woodLook(flat: boolean): string {
    return flat ? 'wood-flat' : 'wood'
}

export const EDGE_LOOK = 'edge'
