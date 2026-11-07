import { MarbleColor } from '@tabletop/zertz'
import { MARBLE_RADIUS, RING_OUTER_RADIUS, type BoardView } from './geometry.js'

// The pieces are shown as images, lit pixel by pixel (board/pieceLight.ts) on the /looks page and
// saved by scripts/render-looks.mjs: one ring for every ring, a body for each colour of marble
// and one shine over every marble. Each marble's own specks lie between its body and its shine
// (board/marbleSpecks.ts). The light is the viewer's, so the turned view shows the same images.

// Pixels per board unit: sharp at the board's full size on a phone.
export const LOOK_PIXELS = 12

export type LookBox = { x: number; y: number; width: number; height: number }

// A whole number of pixels across.
function whole(box: LookBox, pixels: number): LookBox {
    return {
        ...box,
        width: Math.ceil(box.width * pixels) / pixels,
        height: Math.ceil(box.height * pixels) / pixels
    }
}

// About the centre of the ring's hole at its rim: its base, the whole outline, spreads below.
export function ringBox(view: BoardView, pixels = LOOK_PIXELS): LookBox {
    const a = RING_OUTER_RADIUS
    return whole(
        { x: -a, y: -a * view.tilt + view.band, width: 2 * a, height: 2 * a * view.tilt },
        pixels
    )
}

// About the marble's centre.
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
