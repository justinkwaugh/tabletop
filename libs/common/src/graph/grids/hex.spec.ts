import { describe, expect, it } from 'vitest'
import { HexDefinition, HexGrid, HexOrientation, HexGridNode } from '../grids/hex.js'
import { hexSpiralPattern } from '../patterns/hexSpiral.js'
import { createCoordinatedNode } from '../coordinatedGraph.js'

import { AxialCoordinates } from '../coordinates.js'

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
            orientation: HexOrientation.PointyTop,
            dimensions: { radius: 50 }
        }
        const grid = new HexGrid<CustomHexNode>({ hexDefinition })
        expect(grid.minXCoords).toEqual({ q: 0, r: 0 })
        expect(grid.minYCoords).toEqual({ q: 0, r: 0 })
        expect(grid.maxXCoords).toEqual({ q: 0, r: 0 })
        expect(grid.maxYCoords).toEqual({ q: 0, r: 0 })

        const pattern = hexSpiralPattern({ radius: 0, orientation: HexOrientation.PointyTop })
        grid.populateFromPattern(pattern, createCustomHexNode)

        const biggerPattern = hexSpiralPattern({ radius: 1, orientation: HexOrientation.PointyTop })
        grid.populateFromPattern(biggerPattern, createCustomHexNode)

        console.log(grid.nodeAt({ q: 0, r: 0 })?.desc)

        expect(grid.minXCoords).toEqual({ q: -1, r: 0 })
        expect(grid.minYCoords).toEqual({ q: 1, r: -1 })
        expect(grid.maxXCoords).toEqual({ q: 1, r: 0 })
        expect(grid.maxYCoords).toEqual({ q: 0, r: 1 })
    })

    it('calculates min/max coords correctly for flat top grid', () => {
        const hexDefinition: HexDefinition = {
            orientation: HexOrientation.FlatTop,
            dimensions: { radius: 50 }
        }
        const grid = new HexGrid({ hexDefinition })
        expect(grid.minXCoords).toEqual({ q: 0, r: 0 })
        expect(grid.minYCoords).toEqual({ q: 0, r: 0 })
        expect(grid.maxXCoords).toEqual({ q: 0, r: 0 })
        expect(grid.maxYCoords).toEqual({ q: 0, r: 0 })

        const pattern = hexSpiralPattern({ radius: 0, orientation: HexOrientation.FlatTop })
        grid.populateFromPattern(pattern, createCoordinatedNode)

        const biggerPattern = hexSpiralPattern({ radius: 1, orientation: HexOrientation.FlatTop })
        grid.populateFromPattern(biggerPattern, createCoordinatedNode)

        expect(grid.minXCoords).toEqual({ q: -1, r: 1 })
        expect(grid.minYCoords).toEqual({ q: 0, r: -1 })
        expect(grid.maxXCoords).toEqual({ q: 1, r: -1 })
        expect(grid.maxYCoords).toEqual({ q: 0, r: 1 })
    })

    it('calculates pixel width and height correctly for pointy top grid', () => {
        const hexDefinition: HexDefinition = {
            orientation: HexOrientation.PointyTop,
            dimensions: { radius: 50 }
        }
        const grid = new HexGrid({ hexDefinition })
        expect(grid.pixelWidth).toEqual(0)
        expect(grid.pixelHeight).toEqual(0)

        const pattern = hexSpiralPattern({ radius: 0, orientation: HexOrientation.PointyTop })
        grid.populateFromPattern(pattern, createCoordinatedNode)
        expect(grid.pixelWidth).toBeCloseTo(86.6)
        expect(grid.pixelHeight).toEqual(100)

        const biggerPattern = hexSpiralPattern({ radius: 1, orientation: HexOrientation.PointyTop })
        grid.populateFromPattern(biggerPattern, createCoordinatedNode)

        expect(grid.pixelWidth).toBeCloseTo(259.81)
        expect(grid.pixelHeight).toEqual(250)
    })

    it('calculates pixel width and height correctly for flat top grid', () => {
        const hexDefinition: HexDefinition = {
            orientation: HexOrientation.FlatTop,
            dimensions: { width: 100, height: 87 }
        }
        const grid = new HexGrid({ hexDefinition })
        expect(grid.pixelWidth).toEqual(0)
        expect(grid.pixelHeight).toEqual(0)

        const pattern = hexSpiralPattern({ radius: 0, orientation: HexOrientation.PointyTop })
        grid.populateFromPattern(pattern, createCoordinatedNode)
        expect(grid.pixelHeight).toEqual(87)
        expect(grid.pixelWidth).toEqual(100)

        const biggerPattern = hexSpiralPattern({ radius: 6, orientation: HexOrientation.PointyTop })
        grid.populateFromPattern(biggerPattern, createCoordinatedNode)

        expect(grid.pixelWidth).toEqual(1000)
        expect(grid.pixelHeight).toBeCloseTo(1131)
    })
})
