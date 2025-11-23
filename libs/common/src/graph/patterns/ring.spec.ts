import { describe, expect, it } from 'vitest'
import { hexRingPattern } from './ring.js'
import { PointyHexDirection, RotationDirection } from '../directions.js'
import { HexOrientation } from '../grids/hex/definition.js'

describe('Hex Ring Pattern Tests', () => {
    it('generates radius 0 ring', () => {
        const pattern = hexRingPattern({
            radius: 0,
            orientation: HexOrientation.Pointy
        })
        const result = Array.from(pattern())
        expect(result).toEqual([{ q: 0, r: 0 }])
    })

    it('generates radius 1 ring in pointy top orientation', () => {
        const pattern = hexRingPattern({
            radius: 1,
            orientation: HexOrientation.Pointy
        })
        const result = Array.from(pattern())
        expect(result).toEqual([
            { q: 1, r: -1 },
            { q: 1, r: 0 },
            { q: 0, r: 1 },
            { q: -1, r: 1 },
            { q: -1, r: 0 },
            { q: 0, r: -1 }
        ])
    })

    it('generates radius 2 ring in pointy top orientation', () => {
        const pattern = hexRingPattern({
            radius: 2,
            orientation: HexOrientation.Pointy
        })
        const result = Array.from(pattern())
        expect(result).toEqual([
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
            { q: 0, r: -2 },
            { q: 1, r: -2 }
        ])
    })

    it('generates radius 1 ring in pointy top orientation with alternate initial direction', () => {
        const pattern = hexRingPattern({
            radius: 1,
            orientation: HexOrientation.Pointy,
            initialDirection: PointyHexDirection.West
        })
        const result = Array.from(pattern())
        expect(result).toEqual([
            { q: -1, r: 0 },
            { q: 0, r: -1 },
            { q: 1, r: -1 },
            { q: 1, r: 0 },
            { q: 0, r: 1 },
            { q: -1, r: 1 }
        ])
    })

    it('generates radius 1 ring in ccw rotation', () => {
        const pattern = hexRingPattern({
            radius: 1,
            orientation: HexOrientation.Pointy,
            rotationDirection: RotationDirection.Counterclockwise
        })
        const result = Array.from(pattern())
        expect(result).toEqual([
            { q: 1, r: -1 },
            { q: 0, r: -1 },
            { q: -1, r: 0 },
            { q: -1, r: 1 },
            { q: 0, r: 1 },
            { q: 1, r: 0 }
        ])
    })

    it('generates radius 1 ring from alternate center', () => {
        const pattern = hexRingPattern({
            center: { q: 1, r: -1 },
            radius: 1,
            orientation: HexOrientation.Pointy
        })
        const result = Array.from(pattern())
        expect(result).toEqual([
            { q: 2, r: -2 },
            { q: 2, r: -1 },
            { q: 1, r: 0 },
            { q: 0, r: 0 },
            { q: 0, r: -1 },
            { q: 1, r: -2 }
        ])
    })

    it('generates radius 1 ring in flat top orientation', () => {
        const pattern = hexRingPattern({
            radius: 1,
            orientation: HexOrientation.Flat
        })
        const result = Array.from(pattern())
        expect(result).toEqual([
            { q: 1, r: -1 },
            { q: 1, r: 0 },
            { q: 0, r: 1 },
            { q: -1, r: 1 },
            { q: -1, r: 0 },
            { q: 0, r: -1 }
        ])
    })
})
