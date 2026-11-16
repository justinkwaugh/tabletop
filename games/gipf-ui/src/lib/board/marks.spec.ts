import { describe, expect, it } from 'vitest'
import type { AxialCoordinates } from '@tabletop/common'
import { PIECE_RADIUS, viewOf } from './geometry.js'
import { ARROW_START, pushArrow, stackOutline } from './marks.js'

const view = viewOf(false)

describe('pushArrow', () => {
    // The first point of the path is the arrow's tail.
    const tailDistance = (dot: AxialCoordinates, to: AxialCoordinates) => {
        const [x, y] = pushArrow(view, dot, to).split(' ').slice(1, 3).map(Number)
        const start = view.center(dot)
        return Math.hypot(x - start.x, y - start.y)
    }

    it('starts as far from its dot on screen whichever way it points', () => {
        // E1 up onto E2, A1 up the slant onto B2, A5 down the slant onto B5.
        const upright = tailDistance({ q: 0, r: 4 }, { q: 0, r: 3 })
        expect(upright).toBeCloseTo(ARROW_START * view.tilt)
        expect(tailDistance({ q: -4, r: 4 }, { q: -3, r: 3 })).toBeCloseTo(upright)
        expect(tailDistance({ q: -4, r: 0 }, { q: -3, r: 0 })).toBeCloseTo(upright)
    })
})

describe('stackOutline', () => {
    it("reaches from a GIPF-piece's top face down to the spot", () => {
        const outline = stackOutline(view)
        expect(outline.startsWith(`M ${-PIECE_RADIUS} ${view.topFace(true)} `)).toBe(true)
        expect(outline).toContain(`L ${PIECE_RADIUS} 0`)
    })

    it('is the same seen from the far side', () => {
        expect(stackOutline(viewOf(true))).toBe(stackOutline(view))
    })
})
