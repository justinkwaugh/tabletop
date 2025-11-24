import { describe, expect, it } from 'vitest'
import { HexGrid, HexGridNode } from './grid.js'
import { hexSpiralPattern } from '../../patterns/hexSpiral.js'
import { createCoordinatedNode } from '../../coordinatedGraph.js'

import { AxialCoordinates } from '../../coordinates.js'
import { HexDefinition, HexOrientation } from './definition.js'

type CustomHexNode = HexGridNode & {
    desc: string
}

function createCustomHexNode(coords: AxialCoordinates): CustomHexNode {
    return {
        ...createCoordinatedNode(coords),
        desc: `Hex at q=${coords.q}, r=${coords.r}`
    }
}

describe('Hex Utils Tests', () => {
    it('calculates min/max coords correctly for pointy top grid', () => {
        const hexDefinition: HexDefinition = {
            orientation: HexOrientation.Pointy,
            dimensions: { radius: 50 }
        }
        const grid = new HexGrid<CustomHexNode>({ hexDefinition })
        const minMaxCoords = grid.minMaxCoords
        expect(minMaxCoords.minX).toBeUndefined
        expect(minMaxCoords.minY).toBeUndefined
        expect(minMaxCoords.maxX).toBeUndefined
        expect(minMaxCoords.maxY).toBeUndefined

        const pattern = hexSpiralPattern({ radius: 0, orientation: HexOrientation.Pointy })
        grid.populateFromPattern(pattern, createCustomHexNode)
        const minMaxCoords2 = grid.minMaxCoords
        expect(minMaxCoords2.minX).toEqual({ q: 0, r: 0 })
        expect(minMaxCoords2.minY).toEqual({ q: 0, r: 0 })
        expect(minMaxCoords2.maxX).toEqual({ q: 0, r: 0 })
        expect(minMaxCoords2.maxY).toEqual({ q: 0, r: 0 })

        const biggerPattern = hexSpiralPattern({ radius: 1, orientation: HexOrientation.Pointy })
        grid.populateFromPattern(biggerPattern, createCustomHexNode)
        const minMaxCoords3 = grid.minMaxCoords
        expect(minMaxCoords3.minX).toEqual({ q: -1, r: 0 })
        expect(minMaxCoords3.minY).toEqual({ q: 1, r: -1 })
        expect(minMaxCoords3.maxX).toEqual({ q: 1, r: 0 })
        expect(minMaxCoords3.maxY).toEqual({ q: 0, r: 1 })
    })

    it('calculates min/max coords correctly for flat top grid', () => {
        const hexDefinition: HexDefinition = {
            orientation: HexOrientation.Flat,
            dimensions: { radius: 50 }
        }
        const grid = new HexGrid({ hexDefinition })
        const minMaxCoords = grid.minMaxCoords
        expect(minMaxCoords.minX).toBeUndefined
        expect(minMaxCoords.minY).toBeUndefined
        expect(minMaxCoords.maxX).toBeUndefined
        expect(minMaxCoords.maxY).toBeUndefined

        const pattern = hexSpiralPattern({ radius: 0, orientation: HexOrientation.Flat })
        grid.populateFromPattern(pattern, createCoordinatedNode)
        const minMaxCoords2 = grid.minMaxCoords
        expect(minMaxCoords2.minX).toEqual({ q: 0, r: 0 })
        expect(minMaxCoords2.minY).toEqual({ q: 0, r: 0 })
        expect(minMaxCoords2.maxX).toEqual({ q: 0, r: 0 })
        expect(minMaxCoords2.maxY).toEqual({ q: 0, r: 0 })

        const biggerPattern = hexSpiralPattern({ radius: 1, orientation: HexOrientation.Flat })
        grid.populateFromPattern(biggerPattern, createCoordinatedNode)
        const minMaxCoords3 = grid.minMaxCoords
        expect(minMaxCoords3.minX).toEqual({ q: -1, r: 0 })
        expect(minMaxCoords3.minY).toEqual({ q: 0, r: -1 })
        expect(minMaxCoords3.maxX).toEqual({ q: 1, r: 0 })
        expect(minMaxCoords3.maxY).toEqual({ q: 0, r: 1 })
    })

    it('calculates pixel width and height correctly for pointy top grid', () => {
        const hexDefinition: HexDefinition = {
            orientation: HexOrientation.Pointy,
            dimensions: { radius: 50 }
        }
        const grid = new HexGrid({ hexDefinition })
        const boundingBox = grid.boundingBox
        expect(boundingBox.width).toEqual(0)
        expect(boundingBox.height).toEqual(0)

        const pattern = hexSpiralPattern({ radius: 0, orientation: HexOrientation.Pointy })
        grid.populateFromPattern(pattern, createCoordinatedNode)
        const boundingBox2 = grid.boundingBox
        expect(boundingBox2.width).toBeCloseTo(86.6)
        expect(boundingBox2.height).toEqual(100)

        const biggerPattern = hexSpiralPattern({ radius: 1, orientation: HexOrientation.Pointy })
        grid.populateFromPattern(biggerPattern, createCoordinatedNode)
        const boundingBox3 = grid.boundingBox
        expect(boundingBox3.width).toBeCloseTo(259.81)
        expect(boundingBox3.height).toEqual(250)
    })

    it('calculates pixel width and height correctly for flat top grid', () => {
        const hexDefinition: HexDefinition = {
            orientation: HexOrientation.Flat,
            dimensions: { width: 100, height: 87 }
        }
        const grid = new HexGrid({ hexDefinition })
        const boundingBox = grid.boundingBox
        expect(boundingBox.width).toEqual(0)
        expect(boundingBox.height).toEqual(0)

        const pattern = hexSpiralPattern({ radius: 0, orientation: HexOrientation.Pointy })
        grid.populateFromPattern(pattern, createCoordinatedNode)
        const boundingBox2 = grid.boundingBox
        expect(boundingBox2.height).toEqual(87)
        expect(boundingBox2.width).toEqual(100)

        const biggerPattern = hexSpiralPattern({ radius: 6, orientation: HexOrientation.Pointy })
        grid.populateFromPattern(biggerPattern, createCoordinatedNode)
        const boundingBox3 = grid.boundingBox
        expect(boundingBox3.width).toEqual(1000)
        expect(boundingBox3.height).toBeCloseTo(1131)
    })
})
