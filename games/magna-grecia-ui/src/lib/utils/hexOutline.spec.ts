import { describe, expect, it } from 'vitest'
import { ClockwisePointyHexDirections } from '@tabletop/common'
import { neighborCoords, offsetToAxial } from '@tabletop/magna-grecia'
import { hexRegionOutlines } from './hexOutline.js'

const space = (row: number, col: number) => offsetToAxial({ row, col })

describe('hex region outlines', () => {
    it('draws one six-cornered loop around a lone hex', () => {
        const loops = hexRegionOutlines([space(3, 3)])
        expect(loops.map((loop) => loop.length)).toEqual([6])
    })

    it('draws one loop around touching hexes, without the edge they share', () => {
        const loops = hexRegionOutlines([space(3, 3), space(3, 4)])
        expect(loops.map((loop) => loop.length)).toEqual([10])
    })

    it('draws a loop for each group of hexes that do not touch', () => {
        const loops = hexRegionOutlines([space(3, 3), space(3, 6)])
        expect(loops.map((loop) => loop.length)).toEqual([6, 6])
    })

    it('draws a hole inside a ring of hexes as its own loop', () => {
        const centre = space(4, 4)
        const ring = ClockwisePointyHexDirections.map((direction) =>
            neighborCoords(centre, direction)
        )
        const loops = hexRegionOutlines(ring)
        expect(loops.map((loop) => loop.length).toSorted((a, b) => a - b)).toEqual([6, 18])
        expect(hexRegionOutlines([...ring, centre]).map((loop) => loop.length)).toEqual([18])
    })
})
