import { BoardShape } from '@tabletop/game-of-y'
import { boardView } from './geometry.js'

// How far the board may be scaled up: to fit its space, and by zooming in.
const MOST_FIT = 2.5
const MOST_ZOOM = 4
// The widest the board may be drawn, in device pixels. Zoomed in, a phone draws the whole board at
// that width, about 230 MB on Kadon's board at 8,350 px; docs/phone-rendering.md has MarraCash's
// 5,526 px as the size already known to crash-loop iPhones.
const MOST_DRAWN = 5500

export type ZoomLimits = { maxScale: number; maxFitScale: number }

// The scales a board of `shape` may reach on a screen of `pixelRatio`, the same in either view so a
// toggle never changes them: a 1x desktop keeps the full zoom, a 3x phone about 1.6 on the
// 19-cell hex board.
export function zoomLimits(shape: BoardShape, pixelRatio: number): ZoomLimits {
    const width = Math.max(...[false, true].map((flat) => boardView(shape, flat).frame.width))
    const maxScale = Math.min(MOST_ZOOM, MOST_DRAWN / (pixelRatio * width))
    return { maxScale, maxFitScale: Math.min(MOST_FIT, maxScale) }
}
