import { describe, expect, it } from 'vitest'
import { PieceKind, pointAt } from '@tabletop/gipf-potentials'
import { PIECE_RADIUS, VIEW } from './geometry.js'
import { ARROW_START, DASH, DASH_GAP, pushArrow, stackOutline, topRing } from './marks.js'

const view = VIEW
const period = DASH + DASH_GAP

describe('topRing', () => {
    it('rings a plain disc with whole dashes', () => {
        const arcs = topRing(view, { tone: 'light', kind: PieceKind.Basic }, PIECE_RADIUS - 3, -10)
        expect(arcs).toHaveLength(1)
        expect(arcs[0].length % period).toBe(0)
    })

    it("breaks round ZÈRTZ's three notches, each arc starting and ending on a dash", () => {
        const arcs = topRing(view, { tone: 'dark', kind: PieceKind.Zertz }, PIECE_RADIUS - 3, -10)
        expect(arcs).toHaveLength(3)
        for (const arc of arcs) expect((arc.length + DASH_GAP) % period).toBe(0)
    })
})

describe('pushArrow', () => {
    // The first point of the path is the arrow's tail.
    const tailDistance = (dot: string, to: string) => {
        const [x, y] = pushArrow(view, pointAt(dot), pointAt(to)).split(' ').slice(1, 3).map(Number)
        const start = view.center(pointAt(dot))
        return Math.hypot(x - start.x, y - start.y)
    }

    it('starts as far from its dot on screen whichever way it points', () => {
        const upright = tailDistance('E1', 'E2')
        expect(upright).toBeCloseTo(ARROW_START * view.tilt)
        expect(tailDistance('A1', 'B2')).toBeCloseTo(upright)
        expect(tailDistance('A3', 'B3')).toBeCloseTo(upright)
    })
})

describe('stackOutline', () => {
    it('is never lower than a stack of two', () => {
        expect(stackOutline(view, 1)).toBe(stackOutline(view, 2))
        expect(stackOutline(view, 3)).not.toBe(stackOutline(view, 2))
    })
})
