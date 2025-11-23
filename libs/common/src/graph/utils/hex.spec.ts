import { describe, expect, it } from 'vitest'
import { CircleDimensions } from '../dimensions.js'
import {
    calculateHexGeometry,
    circleDimensionsToElliptical,
    hexCoordsToCenterPoint,
    rectangleDimensionsToElliptical
} from './hex.js'
import { HexDefinition, HexOrientation } from '../grids/hex/definition.js'

describe('Hex Utils Tests', () => {
    it('converts to elliptical dimensions correctly', () => {
        const elliptical = rectangleDimensionsToElliptical({ width: 100, height: 87 })
        expect(elliptical).toEqual({ xRadius: 50, yRadius: 43.5 })

        const fromFlatCircle = circleDimensionsToElliptical({ radius: 50 }, HexOrientation.Flat)
        expect(fromFlatCircle.xRadius).toEqual(50)
        expect(fromFlatCircle.yRadius).toBeCloseTo(43.3)

        const fromPointyCircle = circleDimensionsToElliptical({ radius: 50 }, HexOrientation.Pointy)
        expect(fromPointyCircle.xRadius).toBeCloseTo(43.3)
        expect(fromPointyCircle.yRadius).toEqual(50)
    })

    it('calculates pixel positions correctly', () => {
        const pointyDimensions = circleDimensionsToElliptical({ radius: 50 }, HexOrientation.Pointy)

        const centerCoords = { q: 0, r: 0 }
        const centerPoint = hexCoordsToCenterPoint(
            centerCoords,
            pointyDimensions,
            HexOrientation.Pointy
        )
        expect(centerPoint).toEqual({ x: 0, y: 0 })

        const offsetCoords = { q: 0, r: 1 }
        const offsetPoint = hexCoordsToCenterPoint(
            offsetCoords,
            pointyDimensions,
            HexOrientation.Pointy
        )
        expect(offsetPoint.x).toBeCloseTo(43.3)
        expect(offsetPoint.y).toBeCloseTo(75)

        const offsetCoords2 = { q: 1, r: 0 }
        const offsetPoint2 = hexCoordsToCenterPoint(
            offsetCoords2,
            pointyDimensions,
            HexOrientation.Pointy
        )
        expect(offsetPoint2.x).toBeCloseTo(86.6)
        expect(offsetPoint2.y).toBeCloseTo(0)

        const offsetCoords3 = { q: 0, r: -2 }
        const offsetPoint3 = hexCoordsToCenterPoint(
            offsetCoords3,
            pointyDimensions,
            HexOrientation.Pointy
        )
        expect(offsetPoint3.x).toBeCloseTo(-86.6)
        expect(offsetPoint3.y).toBeCloseTo(-150)

        const flatDimensions = rectangleDimensionsToElliptical({ width: 100, height: 87 })

        const flatCenterPoint = hexCoordsToCenterPoint(
            centerCoords,
            flatDimensions,
            HexOrientation.Flat
        )
        expect(flatCenterPoint).toEqual({ x: 0, y: 0 })

        expect(hexCoordsToCenterPoint({ q: 0, r: 1 }, flatDimensions, HexOrientation.Flat)).toEqual(
            {
                x: 0,
                y: 87
            }
        )

        expect(hexCoordsToCenterPoint({ q: 0, r: 2 }, flatDimensions, HexOrientation.Flat)).toEqual(
            {
                x: 0,
                y: 87 * 2
            }
        )
    })

    it('calculates flat top geometry correctly', () => {
        const definition: HexDefinition = {
            orientation: HexOrientation.Flat,
            dimensions: { radius: 50 } satisfies CircleDimensions
        }
        const geometry = calculateHexGeometry(definition, {
            q: 0,
            r: 0
        })
        expect(geometry.center).toEqual({ x: 0, y: 0 })
        expect(geometry.vertices.length).toEqual(6)

        expect(geometry.vertices[0]).toEqual({ x: -25, y: -43.3 })
        expect(geometry.vertices[1]).toEqual({ x: 25, y: -43.3 })
        expect(geometry.vertices[2]).toEqual({ x: 50, y: 0 })
        expect(geometry.vertices[3]).toEqual({ x: 25, y: 43.3 })
        expect(geometry.vertices[4]).toEqual({ x: -25, y: 43.3 })
        expect(geometry.vertices[5]).toEqual({ x: -50, y: 0 })
    })

    it('calculates pointy top geometry correctly', () => {
        const definition: HexDefinition = {
            orientation: HexOrientation.Pointy,
            dimensions: { radius: 50 } satisfies CircleDimensions
        }
        const geometry = calculateHexGeometry(definition, {
            q: 0,
            r: 0
        })
        expect(geometry.center).toEqual({ x: 0, y: 0 })
        expect(geometry.vertices.length).toEqual(6)

        expect(geometry.vertices[0]).toEqual({ x: 43.3, y: -25 })
        expect(geometry.vertices[1]).toEqual({ x: 43.3, y: 25 })
        expect(geometry.vertices[2]).toEqual({ x: 0, y: 50 })
        expect(geometry.vertices[3]).toEqual({ x: -43.3, y: 25 })
        expect(geometry.vertices[4]).toEqual({ x: -43.3, y: -25 })
        expect(geometry.vertices[5]).toEqual({ x: 0, y: -50 })
    })
})
