import { describe, expect, it } from 'vitest'
import { SPACES } from '@tabletop/dvonn'
import { BoardView, GRAPH_VIEW, UNLABELLED_GRAPH_VIEW, UNLABELLED_VIEW, VIEW } from './geometry.js'
import { PIECE_MODEL, PIECE_RADIUS, stackBounds, TILT } from './pieceGeometry.js'

const VIEWS: [string, BoardView, boolean][] = [
    ['sand', VIEW, true],
    ['graph', GRAPH_VIEW, true],
    ['sand, unlabelled', UNLABELLED_VIEW, false],
    ['graph, unlabelled', UNLABELLED_GRAPH_VIEW, false]
]

// A stack's box on screen: its footprint's width, from its top piece down to its near edge.
function stackBox(view: BoardView, coords: (typeof SPACES)[number], height: number) {
    const center = view.center(coords)
    const { top, bottom } = stackBounds(height, PIECE_RADIUS)
    return {
        left: center.x - PIECE_RADIUS,
        right: center.x + PIECE_RADIUS,
        top: center.y + top,
        bottom: center.y + bottom
    }
}

describe.each(VIEWS)('the %s board', (_name, view, labelled) => {
    const { x, y, width, height } = view.frame

    it('frames a full-height stack on every space', () => {
        for (const coords of SPACES) {
            const box = stackBox(view, coords, PIECE_MODEL.cap)
            expect(box.left).toBeGreaterThanOrEqual(x)
            expect(box.right).toBeLessThanOrEqual(x + width)
            expect(box.top).toBeGreaterThanOrEqual(y)
            expect(box.bottom).toBeLessThanOrEqual(y + height)
        }
    })

    // An unlabelled view's frame leaves the labels out; the board does not draw them.
    it.runIf(labelled)('frames its labels clear of a piece on any space', () => {
        for (const { at } of view.labels) {
            expect(at.x).toBeGreaterThan(x)
            expect(at.x).toBeLessThan(x + width)
            expect(at.y).toBeGreaterThan(y)
            expect(at.y).toBeLessThan(y + height)
            for (const coords of SPACES) {
                const center = view.center(coords)
                const dx = (at.x - center.x) / PIECE_RADIUS
                const dy = (at.y - center.y) / (PIECE_RADIUS * TILT)
                expect(Math.hypot(dx, dy)).toBeGreaterThan(1)
            }
        }
    })
})

describe('the board', () => {
    it('labels only the labelled views', () => {
        expect(VIEW.labels.length).toBeGreaterThan(0)
        expect(GRAPH_VIEW.labels.length).toBe(VIEW.labels.length)
        expect(UNLABELLED_VIEW.frame.width).toBeLessThan(VIEW.frame.width)
        expect(UNLABELLED_GRAPH_VIEW.frame.width).toBeLessThan(GRAPH_VIEW.frame.width)
    })
})
