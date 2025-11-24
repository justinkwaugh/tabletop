import { describe, expect, it } from 'vitest'
import { RectilinearGrid } from '../grids/rectilinear/grid.js'
import { coordinatesToNumber, OffsetCoordinates } from '../coordinates.js'
import { linePattern } from '../patterns/line.js'
import { CardinalDirection } from '../directions.js'
import { rectanglePattern } from '../patterns/rectangle.js'
import { patternGenerator } from '../generators/pattern.js'

function createTestNode(coords: OffsetCoordinates) {
    return { id: coordinatesToNumber(coords), coords }
}

describe('Pattern Traverser Tests', () => {
    it('Traverses a line pattern', () => {
        const graph = new RectilinearGrid()
        const nodeGenerator = patternGenerator(
            rectanglePattern({ start: { row: 0, col: 0 }, width: 5, height: 5 }),
            createTestNode
        )
        graph.populate(nodeGenerator)

        const pattern = linePattern({
            start: { row: 0, col: 0 },
            length: 3,
            direction: CardinalDirection.East
        })
        const nodes = Array.from(graph.traversePattern(pattern))
        expect(nodes.length).toEqual(3)
        expect(nodes[0].coords).toEqual({ row: 0, col: 0 })
        expect(nodes[1].coords).toEqual({ row: 0, col: 1 })
        expect(nodes[2].coords).toEqual({ row: 0, col: 2 })
    })

    it('Traverses multiple patterns', () => {
        const graph = new RectilinearGrid()
        const generator = patternGenerator(
            rectanglePattern({ start: { row: 0, col: 0 }, width: 5, height: 5 }),
            createTestNode
        )
        graph.populate(generator)

        const pattern = linePattern({
            start: { row: 0, col: 0 },
            length: 3,
            direction: CardinalDirection.East
        })
        const pattern2 = linePattern({
            start: { row: 0, col: 0 },
            length: 3,
            direction: CardinalDirection.South
        })
        const nodes = Array.from(graph.traversePattern([pattern, pattern2]))
        expect(nodes.length).toEqual(6)
        expect(nodes[0].coords).toEqual({ row: 0, col: 0 })
        expect(nodes[1].coords).toEqual({ row: 0, col: 1 })
        expect(nodes[2].coords).toEqual({ row: 0, col: 2 })
        expect(nodes[3].coords).toEqual({ row: 0, col: 0 })
        expect(nodes[4].coords).toEqual({ row: 1, col: 0 })
        expect(nodes[5].coords).toEqual({ row: 2, col: 0 })
    })

    it('Traverses out of bounds', () => {
        const graph = new RectilinearGrid()
        const nodeGenerator = patternGenerator(
            rectanglePattern({ start: { row: 0, col: 0 }, width: 2, height: 5 }),
            createTestNode
        )
        graph.populate(nodeGenerator)
        const pattern = linePattern({
            start: { row: 0, col: 0 },
            length: 8,
            direction: CardinalDirection.East
        })
        const nodes = Array.from(graph.traversePattern(pattern))
        expect(nodes.length).toEqual(2)
        expect(nodes[0].coords).toEqual({ row: 0, col: 0 })
        expect(nodes[1].coords).toEqual({ row: 0, col: 1 })
    })
})
