import { Color } from '@tabletop/common'
import type { BoardShape, StoneColor } from '@tabletop/game-of-y'
import { riseOf, STONE_RADIUS, STONE_THICKNESS, type Box } from './geometry.js'

// Twice the largest size a stone ordinarily rests at, the repository's rule for images: Kadon's
// board in a 2560x1440 window rests at about 1.7 CSS px per unit. Zoomed in further, stones soften.
export const LOOK_PIXELS = 3.5

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

// Each board's wood, its top as each view sees it and its edge as the tilted view does.
export function woodLook(shape: BoardShape, flat: boolean): string {
    return `wood-${shape.toLowerCase()}${flat ? '-flat' : ''}`
}

export function edgeLook(shape: BoardShape): string {
    return `edge-${shape.toLowerCase()}`
}

export function shadowLook(shape: BoardShape, flat: boolean): string {
    return `shadow-${shape.toLowerCase()}${flat ? '-flat' : ''}`
}
