import { describe, expect, it } from 'vitest'
import { RectilinearGrid } from '../grids/rectilinear.js'
import { coordinatesToNumber, OffsetCoordinates } from '../coordinates.js'
import { line } from '../patterns/line.js'
import { patternTraverser } from './pattern.js'
import { CardinalDirection } from '../directions.js'
import { patternGenerator } from '../generator.js'
import { rectangle } from '../patterns/rectangle.js'

function createTestNode(coords: OffsetCoordinates) {
    return { id: coordinatesToNumber(coords), coords }
}

describe('Pattern Traverser Tests', () => {
    it('Traverses a line pattern', () => {
        const graph = new RectilinearGrid()
        const nodeGenerator = patternGenerator(
            rectangle({ start: { row: 0, col: 0 }, width: 5, height: 5 }),
            createTestNode
        )
        graph.addNodes(nodeGenerator)

        const linePattern = line({
            start: { row: 0, col: 0 },
            length: 3,
            direction: CardinalDirection.East
        })
        const lineTraverser = patternTraverser(linePattern)
        const nodes = Array.from(graph.traverse(lineTraverser))
        expect(nodes.length).toEqual(3)
        expect(nodes[0].coords).toEqual({ row: 0, col: 0 })
        expect(nodes[1].coords).toEqual({ row: 0, col: 1 })
        expect(nodes[2].coords).toEqual({ row: 0, col: 2 })
    })

    it('Traverses multiple patterns', () => {
        const graph = new RectilinearGrid()
        const generator = patternGenerator(
            rectangle({ start: { row: 0, col: 0 }, width: 5, height: 5 }),
            createTestNode
        )
        graph.addNodes(generator)

        const linePattern = line({
            start: { row: 0, col: 0 },
            length: 3,
            direction: CardinalDirection.East
        })
        const linePattern2 = line({
            start: { row: 0, col: 0 },
            length: 3,
            direction: CardinalDirection.South
        })
        const lineTraverser = patternTraverser([linePattern, linePattern2])
        const nodes = Array.from(graph.traverse(lineTraverser))
        expect(nodes.length).toEqual(6)
        expect(nodes[0].coords).toEqual({ row: 0, col: 0 })
        expect(nodes[1].coords).toEqual({ row: 0, col: 1 })
        expect(nodes[2].coords).toEqual({ row: 0, col: 2 })
        expect(nodes[3].coords).toEqual({ row: 0, col: 0 })
        expect(nodes[4].coords).toEqual({ row: 1, col: 0 })
        expect(nodes[5].coords).toEqual({ row: 2, col: 0 })
    })
})
