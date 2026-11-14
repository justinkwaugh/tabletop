import { MarbleColor } from '@tabletop/zertz'
import { MARBLE_RADIUS, RING_OUTER_RADIUS, type BoardView } from './geometry.js'

// The light is the viewer's, so the turned view shows the same images.

// The board fits at up to 2.5 px per unit (GameTable's maxFitScale), and the readiness review
// allows images up to 2.5 times the size they are drawn at.
export const LOOK_PIXELS = 2.5 * 2.5

export type LookBox = { x: number; y: number; width: number; height: number }

function whole(box: LookBox, pixels: number): LookBox {
    return {
        ...box,
        width: Math.ceil(box.width * pixels) / pixels,
        height: Math.ceil(box.height * pixels) / pixels
    }
}

export function ringBox(view: BoardView, pixels = LOOK_PIXELS): LookBox {
    const a = RING_OUTER_RADIUS
    return whole(
        { x: -a, y: -a * view.tilt + view.band, width: 2 * a, height: 2 * a * view.tilt },
        pixels
    )
}

export function marbleBox(pixels = LOOK_PIXELS): LookBox {
    const r = MARBLE_RADIUS
    return whole({ x: -r, y: -r, width: 2 * r, height: 2 * r }, pixels)
}

export const RING_LOOK = 'ring'
export const SHINE_LOOK = 'shine'

export function marbleLook(color: MarbleColor): string {
    return `marble-${color}`
}

export const LOOKS = [RING_LOOK, SHINE_LOOK, ...Object.values(MarbleColor).map(marbleLook)]
