import type { Box, BoardView } from './geometry.js'

// The board's shadow on the table: the slab's outline in a few soft steps, each pushed down and to
// the right and widened by a stroke as wide as it reaches. Drawn once into an image by the /looks
// page, since three board-sized translucent paths cost a phone about 120 MB and 110 ms a repaint
// once zoomed in.
const STEPS = [10, 6, 3]
const COLOR = 'rgb(58 36 16 / 0.07)'
// Far enough out to hold the widest step on every side.
const REACH = Math.max(...STEPS) * 1.2

// A soft shadow on the table needs little detail: a third of the wood's.
export const SHADOW_PIXELS = 0.5

export function shadowBox(view: BoardView): Box {
    const top = view.woodBox.y
    const bottom = view.edgeBox.y + view.edgeBox.height
    return {
        x: view.edgeBox.x - REACH,
        y: top - REACH,
        width: view.edgeBox.width + REACH * 2,
        height: bottom - top + REACH * 2
    }
}

export function drawShadow(context: CanvasRenderingContext2D, view: BoardView, box: Box) {
    const slab = new Path2D(view.slab)
    context.fillStyle = COLOR
    context.strokeStyle = COLOR
    context.lineJoin = 'round'
    for (const reach of STEPS) {
        context.setTransform(
            SHADOW_PIXELS,
            0,
            0,
            SHADOW_PIXELS,
            (reach * 0.5 - box.x) * SHADOW_PIXELS,
            (reach * 0.7 - box.y) * SHADOW_PIXELS
        )
        context.lineWidth = reach
        context.fill(slab)
        context.stroke(slab)
    }
}
