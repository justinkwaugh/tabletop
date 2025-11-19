import { describe, expect, it } from 'vitest'
import { HexOrientation } from '../grids/hex.js'
import { DimensionsRectangle } from '../dimensions.js'
import {
    circleDimensionsToElliptical,
    hexToCenterPoint,
    rectangleDimensionsToElliptical
} from './hex.js'

describe('Hex Utils Tests', () => {
    it('converts to elliptical dimensions correctly', () => {
        const elliptical = rectangleDimensionsToElliptical({ width: 100, height: 87 })
        expect(elliptical).toEqual({ xRadius: 50, yRadius: 43.5 })

        const fromFlatCircle = circleDimensionsToElliptical({ radius: 50 }, HexOrientation.FlatTop)
        expect(fromFlatCircle.xRadius).toEqual(50)
        expect(fromFlatCircle.yRadius).toBeCloseTo(43.3)

        const fromPointyCircle = circleDimensionsToElliptical(
            { radius: 50 },
            HexOrientation.PointyTop
        )
        expect(fromPointyCircle.xRadius).toBeCloseTo(43.3)
        expect(fromPointyCircle.yRadius).toEqual(50)
    })

    it('calculates pixel positions correctly', () => {
        const pointyDimensions = circleDimensionsToElliptical(
            { radius: 50 },
            HexOrientation.PointyTop
        )
        console.log(pointyDimensions)

        const centerCoords = { q: 0, r: 0 }
        const centerPoint = hexToCenterPoint(
            centerCoords,
            pointyDimensions,
            HexOrientation.PointyTop
        )
        expect(centerPoint).toEqual({ x: 0, y: 0 })

        const offsetCoords = { q: 0, r: 1 }
        const offsetPoint = hexToCenterPoint(
            offsetCoords,
            pointyDimensions,
            HexOrientation.PointyTop
        )
        expect(offsetPoint.x).toBeCloseTo(43.3)
        expect(offsetPoint.y).toBeCloseTo(75)

        const offsetCoords2 = { q: 1, r: 0 }
        const offsetPoint2 = hexToCenterPoint(
            offsetCoords2,
            pointyDimensions,
            HexOrientation.PointyTop
        )
        expect(offsetPoint2.x).toBeCloseTo(86.6)
        expect(offsetPoint2.y).toBeCloseTo(0)

        const offsetCoords3 = { q: 0, r: -2 }
        const offsetPoint3 = hexToCenterPoint(
            offsetCoords3,
            pointyDimensions,
            HexOrientation.PointyTop
        )
        expect(offsetPoint3.x).toBeCloseTo(-86.6)
        expect(offsetPoint3.y).toBeCloseTo(-150)

        const flatDimensions = rectangleDimensionsToElliptical({ width: 100, height: 87 })
        console.log(flatDimensions)
        const flatCenterPoint = hexToCenterPoint(
            centerCoords,
            flatDimensions,
            HexOrientation.FlatTop
        )
        expect(flatCenterPoint).toEqual({ x: 0, y: 0 })

        expect(hexToCenterPoint({ q: 0, r: 1 }, flatDimensions, HexOrientation.FlatTop)).toEqual({
            x: 0,
            y: 87
        })

        expect(hexToCenterPoint({ q: 0, r: 2 }, flatDimensions, HexOrientation.FlatTop)).toEqual({
            x: 0,
            y: 87 * 2
        })
    })
})
