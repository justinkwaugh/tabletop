import { describe, expect, it } from 'vitest'
import { RING_SPACING, VIEW } from './geometry.js'
import { pullOuts } from './pullOut.js'

describe('pullOuts', () => {
    it('slides a ring out through its open sides, away from the rings that stay', () => {
        const ring = { q: 1, r: 0 }
        const pull = pullOuts(VIEW, [ring], [{ q: 0, r: 0 }], [{ q: 0, r: 0 }, ring]).get('1,0')
        const away = {
            x: VIEW.center(ring).x - VIEW.center({ q: 0, r: 0 }).x,
            y: VIEW.center(ring).y - VIEW.center({ q: 0, r: 0 }).y
        }
        expect(pull).toBeDefined()
        expect(pull!.x * away.x + pull!.y * away.y).toBeGreaterThan(0)
        expect(Math.hypot(pull!.x, pull!.y / VIEW.tilt)).toBeCloseTo(RING_SPACING)
    })

    it('slides the bottom ring of a column straight down it', () => {
        const ring = { q: 0, r: 0 }
        const neighbours = [
            { q: 0, r: -1 },
            { q: 1, r: -1 },
            { q: 1, r: 0 },
            { q: 0, r: 1 },
            { q: -1, r: 1 },
            { q: -1, r: 0 }
        ]
        // The rings above it, the board beyond them, and a gap where the ring beside it was.
        const above = neighbours.filter((coords) => VIEW.center(coords).y < VIEW.center(ring).y)
        const staying = [...above.slice(1), { q: 0, r: -2 }]
        const layout = [ring, ...above, { q: 0, r: -2 }]
        const pull = pullOuts(VIEW, [ring], staying, layout).get('0,0')
        expect(pull!.x).toBeCloseTo(0)
        expect(pull!.y).toBeGreaterThan(0)
    })

    it('moves rings removed together as one', () => {
        const removed = [
            { q: 2, r: 0 },
            { q: 3, r: 0 }
        ]
        const staying = [
            { q: 0, r: 0 },
            { q: 1, r: 0 }
        ]
        const pulls = pullOuts(VIEW, removed, staying, [...staying, ...removed])
        expect(pulls.get('2,0')).toEqual(pulls.get('3,0'))
    })
})
