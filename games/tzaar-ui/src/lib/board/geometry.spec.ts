import { describe, expect, it } from 'vitest'
import { SPACES, spaceFromName } from '@tabletop/tzaar'
import { BoardView, VIEW, viewOf } from './geometry.js'
import { PIECE_RADIUS, SPACING_UNIT, stackBounds, TILT } from './pieceGeometry.js'

const VIEWS: [string, BoardView, boolean][] = [true, false].flatMap((shrink) =>
    [false, true].flatMap((turned) =>
        [false, true].flatMap((rotated) =>
            [true, false].map((labelled): [string, BoardView, boolean] => [
                [
                    rotated ? 'rotated' : 'upright',
                    turned ? 'far side' : 'near side',
                    labelled ? 'labelled' : 'unlabelled',
                    shrink ? 'stacks shrunk' : 'stacks whole'
                ].join(', '),
                viewOf(labelled, rotated, turned, shrink),
                labelled
            ])
        )
    )
)

describe.each(VIEWS)('the %s board', (_name, view, labelled) => {
    const { x, y, width, height } = view.frame

    it('frames a full-height stack on every space', () => {
        for (const coords of SPACES) {
            const center = view.center(coords)
            const { top, bottom } = stackBounds(view.framedHeight, PIECE_RADIUS, view.model)
            expect(center.x - PIECE_RADIUS).toBeGreaterThanOrEqual(x)
            expect(center.x + PIECE_RADIUS).toBeLessThanOrEqual(x + width)
            expect(center.y + top).toBeGreaterThanOrEqual(y)
            expect(center.y + bottom).toBeLessThanOrEqual(y + height)
        }
    })

    it.runIf(labelled)(
        'frames its labels, each clear of a single piece at its column’s end',
        () => {
            const single = stackBounds(1, PIECE_RADIUS)
            for (const label of view.labels) {
                const center = view.center(label.coords)
                const at = view.labelAt(label)
                expect(at.x).toBeGreaterThan(x)
                expect(at.x).toBeLessThan(x + width)
                expect(at.y).toBeGreaterThan(y)
                expect(at.y).toBeLessThan(y + height)
                const clear = view.rotated
                    ? Math.abs(at.x - center.x) > PIECE_RADIUS
                    : label.above !== view.turned
                      ? at.y < center.y + single.top
                      : at.y > center.y + single.bottom
                expect(clear).toBe(true)
            }
        }
    )
})

describe('the board', () => {
    it('names the ends of every column as the rulebook does', () => {
        expect(VIEW.labels.map((label) => label.text).sort()).toEqual(
            [
                'A1',
                'A5',
                'B1',
                'B6',
                'C1',
                'C7',
                'D1',
                'D8',
                'E1',
                'E8',
                'F1',
                'F8',
                'G1',
                'G7',
                'H1',
                'H6',
                'I1',
                'I5'
            ].sort()
        )
    })

    it('keeps the footprints of neighbours up a column apart', () => {
        expect(2 * PIECE_RADIUS).toBeLessThanOrEqual(SPACING_UNIT)
        expect(TILT).toBe(0.75)
    })

    it('draws no line across the centre', () => {
        const centre = VIEW.center({ q: 0, r: 0 })
        for (const { from, to } of VIEW.lines) {
            const length = Math.hypot(to.x - from.x, to.y - from.y)
            const along =
                ((centre.x - from.x) * (to.x - from.x) + (centre.y - from.y) * (to.y - from.y)) /
                length ** 2
            const nearest = {
                x: from.x + (to.x - from.x) * along,
                y: from.y + (to.y - from.y) * along
            }
            const passes =
                along > 0 && along < 1 && Math.hypot(nearest.x - centre.x, nearest.y - centre.y) < 1
            expect(passes).toBe(false)
        }
    })

    it('raises the frame over a whole stack that would stand out of it, and only then', () => {
        const top = spaceFromName('E8')
        for (const shrink of [true, false]) {
            const view = viewOf(true, false, false, shrink)
            expect(view.raiseFor([{ coords: top, height: 5 }])).toBe(0)
        }
        const shrunk = viewOf(true, false, false, true)
        expect(shrunk.raiseFor([{ coords: top, height: 18 }], [shrunk.frame.y - 50])).toBe(0)

        const whole = viewOf(true, false, false, false)
        const frame = whole.raised(whole.raiseFor([{ coords: top, height: 18 }]))
        const stackTop = whole.center(top).y + stackBounds(18, PIECE_RADIUS, whole.model).top
        expect(frame.y).toBeLessThan(stackTop)
        expect(frame.y + frame.height).toBeCloseTo(whole.frame.y + whole.frame.height)
        expect(whole.raiseFor([], [whole.frame.y - 50])).toBeGreaterThan(50)
    })
})
