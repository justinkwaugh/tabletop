import { describe, expect, it } from 'vitest'
import { MarketColor, Shops } from '@tabletop/marracash'
import { rugFringe, rugOutline, stallKind, stallOutline, tentOutline } from './stalls.js'

describe('stalls', () => {
    it('gives every market colour both tents and rugs', () => {
        for (const color of Object.values(MarketColor)) {
            const kinds = new Set(
                Shops.filter((shop) => shop.color === color).map((shop) => stallKind(shop.id))
            )
            expect(kinds).toEqual(new Set(['tent', 'rug']))
        }
    })

    it('draws the same rug for a shop every time', () => {
        expect(rugOutline('P1', 64, 148)).toBe(rugOutline('P1', 64, 148))
        expect(rugOutline('P1', 64, 148)).not.toBe(rugOutline('P2', 64, 148))
    })

    it('outlines each shop by its stall kind', () => {
        expect(stallOutline('Y1', 148, 68)).toBe(tentOutline(148, 68))
        expect(stallOutline('Y2', 148, 68)).toBe(rugOutline('Y2', 148, 68))
    })

    it('fringes only the short ends of a rug', () => {
        const fringe = rugFringe(148, 68)
        expect(fringe.length).toBeGreaterThan(0)
        expect(fringe.every((segment) => segment.from.y === segment.to.y)).toBe(true)
        expect(new Set(fringe.map((segment) => segment.from.x))).toEqual(new Set([0, 148]))
    })
})
