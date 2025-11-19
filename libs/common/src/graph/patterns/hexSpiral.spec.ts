import { describe, expect, it } from 'vitest'
import { HexOrientation } from '../grids/hex.js'
import { hexSpiralPattern } from './hexSpiral.js'

describe('Hex Spiral Pattern Tests', () => {
    it('generates radius 0 spiral', () => {
        const pattern = hexSpiralPattern({
            radius: 0,
            orientation: HexOrientation.PointyTop
        })
        const result = Array.from(pattern())
        expect(result).toEqual([{ q: 0, r: 0 }])
    })

    it('generates radius 1 spiral in pointy top orientation', () => {
        const pattern = hexSpiralPattern({
            radius: 1,
            orientation: HexOrientation.PointyTop
        })
        const result = Array.from(pattern())
        expect(result).toEqual([
            { q: 0, r: 0 },
            { q: 1, r: -1 },
            { q: 1, r: 0 },
            { q: 0, r: 1 },
            { q: -1, r: 1 },
            { q: -1, r: 0 },
            { q: 0, r: -1 }
        ])
    })

    it('generates radius 2 spiral in pointy top orientation', () => {
        const pattern = hexSpiralPattern({
            radius: 2,
            orientation: HexOrientation.PointyTop
        })
        const result = Array.from(pattern())
        expect(result).toEqual([
            { q: 0, r: 0 },
            { q: 1, r: -1 },
            { q: 1, r: 0 },
            { q: 0, r: 1 },
            { q: -1, r: 1 },
            { q: -1, r: 0 },
            { q: 0, r: -1 },
            { q: 1, r: -2 },
            { q: 2, r: -2 },
            { q: 2, r: -1 },
            { q: 2, r: 0 },
            { q: 1, r: 1 },
            { q: 0, r: 2 },
            { q: -1, r: 2 },
            { q: -2, r: 2 },
            { q: -2, r: 1 },
            { q: -2, r: 0 },
            { q: -1, r: -1 },
            { q: 0, r: -2 }
        ])
    })
})
