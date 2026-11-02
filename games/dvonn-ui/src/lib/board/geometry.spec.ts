import { describe, expect, it } from 'vitest'
import { SPACES } from '@tabletop/dvonn'
import { BoardView, FRAMED_HEIGHT, viewFor } from './geometry.js'
import { PIECE_MODEL, PIECE_RADIUS, stackBounds, TILT } from './pieceGeometry.js'

const VIEW = viewFor(false, true, false)
const GRAPH_VIEW = viewFor(true, true, false)
const UNLABELLED_VIEW = viewFor(false, false, false)
const UNLABELLED_GRAPH_VIEW = viewFor(true, false, false)

const VIEWS: [string, BoardView, boolean][] = [
    ['sand', VIEW, true],
    ['graph', GRAPH_VIEW, true],
    ['sand, unlabelled', UNLABELLED_VIEW, false],
    ['graph, unlabelled', UNLABELLED_GRAPH_VIEW, false],
    ['sand, turned', viewFor(false, true, true), true],
    ['graph, unlabelled, turned', viewFor(true, false, true), false]
]

// A stack's box on screen: its footprint's width, from its top piece down to its near edge.
// Stacks drawn whole, as tall as they are.
function stackBox(view: BoardView, coords: (typeof SPACES)[number], height: number) {
    const center = view.center(coords)
    const whole = { ...PIECE_MODEL, cap: Math.max(PIECE_MODEL.cap, height) }
    const { top, bottom } = stackBounds(height, PIECE_RADIUS, whole)
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

describe('the board with whole stacks', () => {
    it('frames a 30-high stack on every space', () => {
        for (const turned of [false, true]) {
            const view = viewFor(false, true, turned)
            for (const coords of SPACES) {
                const box = stackBox(view, coords, FRAMED_HEIGHT)
                expect(box.top).toBeGreaterThanOrEqual(view.frame.y)
            }
            expect(view.frame.width).toBeCloseTo(VIEW.frame.width)
        }
    })
})

describe('the board turned half round', () => {
    it('puts each space where the opposite space was, and keeps the frame', () => {
        const turned = viewFor(false, true, true)
        for (const coords of SPACES) {
            const opposite = { q: -coords.q, r: -coords.r }
            expect(turned.center(coords).x).toBeCloseTo(VIEW.center(opposite).x)
            expect(turned.center(coords).y).toBeCloseTo(VIEW.center(opposite).y)
        }
        expect(turned.frame.width).toBeCloseTo(VIEW.frame.width)
        expect(turned.frame.height).toBeCloseTo(VIEW.frame.height)
    })
})
